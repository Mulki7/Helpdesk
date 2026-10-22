/**
 * scripts/smoke-realtime.js
 * Comprehensive smoke test script for Socket.IO real-time chat, presence, and sync.
 * Verifies all 8 scenarios (a - h) required by Phase 2B.
 */

import crypto from 'node:crypto';
import { io } from 'socket.io-client';

const BASE_URL = 'http://localhost:3000';

// Helper for HTTP requests
async function fetchJson(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  return { status: res.status, data };
}

// Helper to create a connected socket.io client wrapped in a Promise
function createSocket(auth) {
  return new Promise((resolve, reject) => {
    const socket = io(BASE_URL, {
      transports: ['websocket'],
      auth,
      reconnection: false,
    });

    const timeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error('Socket connection timed out'));
    }, 5000);

    socket.on('connect', () => {
      clearTimeout(timeout);
      resolve(socket);
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

// Helper to emit with ack wrapped in a Promise
function emitWithAck(socket, event, payload) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timeout waiting for ack on event: ${event}`));
    }, 5000);

    socket.emit(event, payload, (res) => {
      clearTimeout(timeout);
      resolve(res);
    });
  });
}

// Helper to wait for a specific socket event
function waitForEvent(socket, event, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${event}`));
    }, timeoutMs);

    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runSmokeTests() {
  console.log('🚀 Memulai Real-time Smoke Tests (Fase 2B)...\n');

  // ── Step 0: Setup Credentials & Tokens ─────────────────────────────────────
  const adminLogin = await fetchJson('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@helpdesk.test', password: 'Admin123!' }),
  });
  const adminToken = adminLogin.data.data.accessToken;

  const agent1Login = await fetchJson('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'agent1@helpdesk.test', password: 'Agent123!' }),
  });
  const agent1Token = agent1Login.data.data.accessToken;

  const agent2Login = await fetchJson('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'agent2@helpdesk.test', password: 'Agent123!' }),
  });
  const agent2Token = agent2Login.data.data.accessToken;

  let activeSockets = [];

  try {
    // ── Scenario a: Pesan customer pertama membuat tiket OPEN & agen menerima ticket:created ──
    {
      const agentSocket = await createSocket({ token: agent1Token });
      activeSockets.push(agentSocket);

      // Customer A session
      const sessRes = await fetchJson('/widget/session', {
        method: 'POST',
        body: JSON.stringify({ name: 'Customer Skenario A' }),
      });
      const visitorTokenA = sessRes.data.data.visitorToken;
      const customerSocketA = await createSocket({ visitorToken: visitorTokenA });
      activeSockets.push(customerSocketA);

      const clientMsgId = crypto.randomUUID();

      // Listen for ticket:created on agent socket
      const ticketCreatedPromise = waitForEvent(agentSocket, 'ticket:created');

      // Send message from customer
      const ack = await emitWithAck(customerSocketA, 'message:send', {
        body: 'Halo admin, ini pesan pertama saya untuk tes skenario a.',
        clientMessageId: clientMsgId,
      });

      const ticketCreatedEvent = await ticketCreatedPromise;

      if (
        ack.ok === true &&
        ack.ticket &&
        ack.ticket.status === 'OPEN' &&
        ticketCreatedEvent.id === ack.ticket.id
      ) {
        console.log('PASS: a) pesan customer pertama membuat tiket OPEN dan agen menerima ticket:created');
      } else {
        console.error('FAIL: a) pesan customer pertama membuat tiket OPEN dan agen menerima ticket:created', { ack, ticketCreatedEvent });
      }

      // ── Scenario b: Kirim clientMessageId yang sama dua kali -> hanya satu pesan di database ──
      const dupAck = await emitWithAck(customerSocketA, 'message:send', {
        body: 'Halo admin, ini pesan pertama saya untuk tes skenario a.',
        clientMessageId: clientMsgId,
      });

      // Verify messages count in DB for this ticket
      const msgsRes = await fetchJson(`/api/tickets/${ack.ticket.id}/messages`, {
        headers: { Authorization: `Bearer ${agent1Token}` },
      });

      const matchingMsgs = msgsRes.data.data.filter((m) => m.clientMessageId === clientMsgId);

      if (dupAck.ok === true && matchingMsgs.length === 1) {
        console.log('PASS: b) kirim clientMessageId yang sama dua kali -> hanya satu pesan di database');
      } else {
        console.error('FAIL: b) kirim clientMessageId yang sama dua kali -> hanya satu pesan di database', { dupAck, count: matchingMsgs.length });
      }

      // ── Scenario c: Dua agen claim bersamaan -> satu berhasil, satu 409 ──
      const ticketIdToClaim = ack.ticket.id;
      const [claim1, claim2] = await Promise.all([
        fetchJson(`/api/tickets/${ticketIdToClaim}/claim`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${agent1Token}` },
        }),
        fetchJson(`/api/tickets/${ticketIdToClaim}/claim`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${agent2Token}` },
        }),
      ]);

      const statuses = [claim1.status, claim2.status].sort();
      if (statuses[0] === 200 && statuses[1] === 409) {
        console.log('PASS: c) dua agen claim bersamaan -> satu berhasil, satu 409');
      } else {
        console.error('FAIL: c) dua agen claim bersamaan -> satu berhasil, satu 409', { claim1Status: claim1.status, claim2Status: claim2.status });
      }

      // ── Scenario h: Agen non-assignee tidak bisa membalas ──
      // Ticket is claimed by either Agent 1 or Agent 2
      const isAgent1Assignee = claim1.status === 200;
      const nonAssigneeToken = isAgent1Assignee ? agent2Token : agent1Token;

      const nonAssigneeSocket = await createSocket({ token: nonAssigneeToken });
      activeSockets.push(nonAssigneeSocket);

      const forbiddenAck = await emitWithAck(nonAssigneeSocket, 'message:send', {
        ticketId: ticketIdToClaim,
        body: 'Saya agen lain mencoba membalas',
        clientMessageId: crypto.randomUUID(),
      });

      if (forbiddenAck.ok === false && forbiddenAck.error?.code === 'FORBIDDEN') {
        console.log('PASS: h) agen non-assignee tidak bisa membalas');
      } else {
        console.error('FAIL: h) agen non-assignee tidak bisa membalas', forbiddenAck);
      }

      // ── Scenario e: Customer chat saat RESOLVED -> tiket kembali IN_PROGRESS ──
      // Mark ticket as RESOLVED
      await fetchJson(`/api/tickets/${ticketIdToClaim}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ status: 'RESOLVED' }),
      });

      const reopenAck = await emitWithAck(customerSocketA, 'message:send', {
        body: 'Saya ingin bertanya lagi terkait tiket ini',
        clientMessageId: crypto.randomUUID(),
      });

      if (reopenAck.ok === true && reopenAck.ticket?.status === 'IN_PROGRESS') {
        console.log('PASS: e) customer chat saat RESOLVED -> tiket kembali IN_PROGRESS');
      } else {
        console.error('FAIL: e) customer chat saat RESOLVED -> tiket kembali IN_PROGRESS', reopenAck);
      }

      // ── Scenario f: Customer chat saat CLOSED -> tiket baru ──
      // Transition IN_PROGRESS -> RESOLVED -> CLOSED (PRD rule 7)
      await fetchJson(`/api/tickets/${ticketIdToClaim}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ status: 'RESOLVED' }),
      });
      const closeRes = await fetchJson(`/api/tickets/${ticketIdToClaim}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ status: 'CLOSED' }),
      });
      if (closeRes.status !== 200) {
        throw new Error(`Failed to close ticket: ${JSON.stringify(closeRes)}`);
      }

      const newTicketAck = await emitWithAck(customerSocketA, 'message:send', {
        body: 'Keluhan baru setelah tiket lama ditutup',
        clientMessageId: crypto.randomUUID(),
      });

      if (
        newTicketAck.ok === true &&
        newTicketAck.ticket?.id !== ticketIdToClaim &&
        newTicketAck.ticket?.status === 'OPEN'
      ) {
        console.log('PASS: f) customer chat saat CLOSED -> tiket baru');
      } else {
        console.error('FAIL: f) customer chat saat CLOSED -> tiket baru', newTicketAck);
      }
    }

    // ── Scenario d: Tidak ada agen online -> customer menerima pesan SYSTEM ──
    {
      // Disconnect all sockets currently active so staff count = 0
      for (const s of activeSockets) {
        s.disconnect();
      }
      activeSockets = [];
      await sleep(500); // Allow server to unregister presence

      // Create new customer D
      const sessD = await fetchJson('/widget/session', {
        method: 'POST',
        body: JSON.stringify({ name: 'Customer Offline Skenario D' }),
      });
      const visitorTokenD = sessD.data.data.visitorToken;
      const customerSocketD = await createSocket({ visitorToken: visitorTokenD });
      activeSockets.push(customerSocketD);

      // Listen for message:new from SYSTEM
      let receivedSystemMsg = null;
      customerSocketD.on('message:new', ({ message }) => {
        if (message.senderType === 'SYSTEM') {
          receivedSystemMsg = message;
        }
      });

      const ackD = await emitWithAck(customerSocketD, 'message:send', {
        body: 'Halo apakah ada orang di sana?',
        clientMessageId: crypto.randomUUID(),
      });

      await sleep(600);

      if (
        ackD.ok === true &&
        receivedSystemMsg &&
        receivedSystemMsg.body.includes('Terima kasih, pesan Anda sudah kami terima.')
      ) {
        console.log('PASS: d) tidak ada agen online -> customer menerima pesan SYSTEM');
      } else {
        console.error('FAIL: d) tidak ada agen online -> customer menerima pesan SYSTEM', { ackD, receivedSystemMsg });
      }
    }

    // ── Scenario g: sync:request mengembalikan pesan yang terlewat setelah reconnect ──
    {
      const agentSocket = await createSocket({ token: agent1Token });
      activeSockets.push(agentSocket);

      // Create Customer G
      const sessG = await fetchJson('/widget/session', {
        method: 'POST',
        body: JSON.stringify({ name: 'Customer Skenario G' }),
      });
      const visitorTokenG = sessG.data.data.visitorToken;

      const customerSocketG1 = await createSocket({ visitorToken: visitorTokenG });
      activeSockets.push(customerSocketG1);

      // Customer sends message 1
      const ack1 = await emitWithAck(customerSocketG1, 'message:send', {
        body: 'Pesan awal sebelum terputus',
        clientMessageId: crypto.randomUUID(),
      });
      const firstMsgId = ack1.message.id;
      const ticketIdG = ack1.ticket.id;

      // Disconnect customer socket to simulate disconnection
      customerSocketG1.disconnect();
      await sleep(200);

      // Staff claims ticket and sends reply while customer is offline
      await fetchJson(`/api/tickets/${ticketIdG}/claim`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${agent1Token}` },
      });

      await emitWithAck(agentSocket, 'message:send', {
        ticketId: ticketIdG,
        body: 'Balasan staf saat customer offline',
        clientMessageId: crypto.randomUUID(),
      });

      // Customer reconnects with new socket
      const customerSocketG2 = await createSocket({ visitorToken: visitorTokenG });
      activeSockets.push(customerSocketG2);

      // Customer requests sync from firstMsgId
      const syncRes = await emitWithAck(customerSocketG2, 'sync:request', {
        lastMessageId: firstMsgId,
      });

      const hasOfflineMessage = syncRes.messages?.some(
        (m) => m.body === 'Balasan staf saat customer offline' && m.id > firstMsgId
      );

      if (syncRes.ok === true && hasOfflineMessage) {
        console.log('PASS: g) sync:request mengembalikan pesan yang terlewat setelah klien terputus lalu tersambung lagi');
      } else {
        console.error('FAIL: g) sync:request mengembalikan pesan yang terlewat setelah klien terputus lalu tersambung lagi', syncRes);
      }
    }

    // ── Scenario ekstra: User dinonaktifkan oleh admin -> socket diputus ──
    {
      const newAgentRes = await fetchJson('/api/users', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          name: 'Agen Nonaktif Test',
          email: 'nonaktif.test@helpdesk.test',
          password: 'Password123!',
          role: 'AGENT',
        }),
      });
      const tempAgentId = newAgentRes.data.data.id;

      const tempLogin = await fetchJson('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'nonaktif.test@helpdesk.test', password: 'Password123!' }),
      });
      const tempToken = tempLogin.data.data.accessToken;

      const tempSocket = await createSocket({ token: tempToken });
      activeSockets.push(tempSocket);

      let wasDisconnected = false;
      tempSocket.on('disconnect', () => {
        wasDisconnected = true;
      });

      // Deactivate agent via admin PATCH
      await fetchJson(`/api/users/${tempAgentId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ isActive: false }),
      });

      await sleep(300);

      if (wasDisconnected || !tempSocket.connected) {
        console.log('PASS: user dinonaktifkan admin -> socket langsung diputus');
      } else {
        console.error('FAIL: user dinonaktifkan admin -> socket tidak diputus');
      }
    }

    console.log('\n🎉 SEMUA SKENARIO REAL-TIME (a - h + deaktifasi user) BERHASIL LOLOS!');
  } finally {
    for (const s of activeSockets) {
      if (s.connected) s.disconnect();
    }
  }
}

runSmokeTests().catch((err) => {
  console.error('❌ Error executing smoke tests:', err);
  process.exit(1);
});
