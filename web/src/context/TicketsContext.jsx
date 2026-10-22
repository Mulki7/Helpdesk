import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import * as ticketsApi from '../api/tickets.js';
import { onSocketEvent, sendStaffMessage, requestSync, withFlushLock } from '../socket/index.js';
import { useAuth } from './AuthContext.jsx';

const TicketsContext = createContext(null);

export function TicketsProvider({ children }) {
  const { user } = useAuth();

  // Filters & Search
  const [activeTab, setActiveTab] = useState('antrean'); // 'antrean' | 'mine' | 'all' | 'resolved' | 'closed'
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Ticket list & counts
  const [tickets, setTickets] = useState([]);
  const [counts, setCounts] = useState({
    antrean: 0,
    mine: 0,
    all: 0,
    resolved: 0,
    closed: 0,
  });
  const [loadingTickets, setLoadingTickets] = useState(false);

  // Selected ticket & detail
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [events, setEvents] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Pending queue for outgoing messages (in-memory)
  const pendingQueueRef = useRef([]);

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Build query params based on activeTab and debouncedQuery
  const buildQueryParams = useCallback(() => {
    const params = {};
    if (debouncedQuery.trim()) {
      params.q = debouncedQuery.trim();
    }

    switch (activeTab) {
      case 'antrean':
        params.status = 'OPEN';
        params.assigned = 'none';
        break;
      case 'mine':
        params.assigned = 'me';
        break;
      case 'resolved':
        params.status = 'RESOLVED';
        break;
      case 'closed':
        params.status = 'CLOSED';
        break;
      case 'all':
      default:
        break;
    }
    return params;
  }, [activeTab, debouncedQuery]);

  // Fetch ticket list and counts from backend
  const fetchTickets = useCallback(async () => {
    if (!user) return;
    setLoadingTickets(true);
    try {
      const params = buildQueryParams();
      const res = await ticketsApi.getTickets(params);
      const items = res.items || res.tickets || [];
      setTickets(items);

      if (res.counts) {
        setCounts({
          antrean: res.counts.antrean ?? res.counts.openUnassigned ?? res.counts.OPEN ?? 0,
          mine: res.counts.mine ?? res.counts.myTickets ?? 0,
          all: res.counts.all ?? res.counts.total ?? res.counts.ALL ?? 0,
          resolved: res.counts.resolved ?? res.counts.RESOLVED ?? 0,
          closed: res.counts.closed ?? res.counts.CLOSED ?? 0,
        });
      }
    } catch (err) {
      console.error('[TicketsContext] Gagal memuat tiket:', err);
    } finally {
      setLoadingTickets(false);
    }
  }, [user, buildQueryParams]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Load ticket detail, messages, and events when selectedTicketId changes
  const loadTicketDetail = useCallback(async (ticketId) => {
    if (!ticketId) {
      setSelectedTicket(null);
      setMessages([]);
      setEvents([]);
      return;
    }

    setLoadingDetail(true);
    try {
      const [detailData, messagesData] = await Promise.all([
        ticketsApi.getTicketDetail(ticketId),
        ticketsApi.getTicketMessages(ticketId),
      ]);

      setSelectedTicket(detailData);
      setEvents(detailData.events || []);

      // Merge messages with any pending messages for this ticket
      const messageList = Array.isArray(messagesData)
        ? messagesData
        : (messagesData?.messages || []);
      const pendingForTicket = pendingQueueRef.current.filter((p) => p.ticketId === ticketId);
      const combined = [...messageList, ...pendingForTicket];
      setMessages(deduplicateMessages(combined));
    } catch (err) {
      console.error('[TicketsContext] Gagal memuat detail tiket:', err);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    loadTicketDetail(selectedTicketId);
  }, [selectedTicketId, loadTicketDetail]);

  // Helper: Deduplicate messages by message.id AND clientMessageId
  function deduplicateMessages(msgs) {
    const result = [];
    const seenIds = new Set();
    const seenClientIds = new Set();

    for (const msg of msgs) {
      if (msg.id && seenIds.has(msg.id)) continue;
      if (msg.clientMessageId && seenClientIds.has(msg.clientMessageId)) continue;

      if (msg.id) seenIds.add(msg.id);
      if (msg.clientMessageId) seenClientIds.add(msg.clientMessageId);
      result.push(msg);
    }

    return result.sort((a, b) => {
      if (a.id && b.id) return a.id - b.id;
      if (a.id) return -1;
      if (b.id) return 1;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });
  }

  // Flush pending messages sequentially (mutex-guarded)
  const flushPendingQueue = useCallback(async () => {
    await withFlushLock(async () => {
      const queue = [...pendingQueueRef.current];
      for (const item of queue) {
        if (item.status === 'failed') continue;

        const ack = await sendStaffMessage({
          ticketId: item.ticketId,
          body: item.body,
          clientMessageId: item.clientMessageId,
        });

        if (ack?.ok) {
          // Ack success
          pendingQueueRef.current = pendingQueueRef.current.filter(
            (p) => p.clientMessageId !== item.clientMessageId
          );
          setMessages((prev) =>
            prev.map((m) =>
              m.clientMessageId === item.clientMessageId
                ? { ...m, ...ack.message, status: 'sent' }
                : m
            )
          );
        } else if (ack?.code === 'TIMEOUT' || ack?.code === 'DISCONNECTED') {
          // Temporary network failure — keep pending and retry later
          break;
        } else {
          // Validation error or permission error — mark failed
          setMessages((prev) =>
            prev.map((m) =>
              m.clientMessageId === item.clientMessageId
                ? { ...m, status: 'failed', errorMessage: ack?.error?.message || 'Gagal terkirim' }
                : m
            )
          );
          pendingQueueRef.current = pendingQueueRef.current.filter(
            (p) => p.clientMessageId !== item.clientMessageId
          );
        }
      }
    });
  }, []);

  // Send message
  const sendMessage = useCallback(
    async (body) => {
      if (!selectedTicketId || !body.trim()) return;

      const clientMessageId = crypto.randomUUID();
      const pendingMsg = {
        id: null,
        ticketId: selectedTicketId,
        clientMessageId,
        body: body.trim(),
        senderType: 'AGENT',
        senderUserId: user?.id,
        senderUser: { id: user?.id, name: user?.name },
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      // Add to messages optimistically & enqueue
      setMessages((prev) => [...prev, pendingMsg]);
      pendingQueueRef.current.push(pendingMsg);

      // Send via socket
      const ack = await sendStaffMessage({
        ticketId: selectedTicketId,
        body: pendingMsg.body,
        clientMessageId,
      });

      if (ack?.ok) {
        // Ack confirmed
        pendingQueueRef.current = pendingQueueRef.current.filter(
          (p) => p.clientMessageId !== clientMessageId
        );
        setMessages((prev) =>
          prev.map((m) =>
            m.clientMessageId === clientMessageId ? { ...m, ...ack.message, status: 'sent' } : m
          )
        );
        if (ack.ticket) {
          setSelectedTicket((prev) => (prev ? { ...prev, ...ack.ticket } : prev));
          setTickets((prev) =>
            prev.map((t) => (t.id === ack.ticket.id ? { ...t, ...ack.ticket } : t))
          );
        }
      } else if (ack?.code === 'TIMEOUT' || ack?.code === 'DISCONNECTED') {
        // Keep in queue with pending status
      } else {
        // Permanent validation or permission error
        setMessages((prev) =>
          prev.map((m) =>
            m.clientMessageId === clientMessageId
              ? { ...m, status: 'failed', errorMessage: ack?.error?.message || 'Gagal terkirim' }
              : m
          )
        );
        pendingQueueRef.current = pendingQueueRef.current.filter(
          (p) => p.clientMessageId !== clientMessageId
        );
      }
    },
    [selectedTicketId, user]
  );

  // Discard failed message
  const discardMessage = useCallback((clientMessageId) => {
    setMessages((prev) => prev.filter((m) => m.clientMessageId !== clientMessageId));
    pendingQueueRef.current = pendingQueueRef.current.filter(
      (p) => p.clientMessageId !== clientMessageId
    );
  }, []);

  // Socket event listeners & reconnect sync recovery
  useEffect(() => {
    // 1. ticket:created
    const unCreated = onSocketEvent('ticket:created', (newTicket) => {
      setTickets((prev) => {
        if (prev.some((t) => t.id === newTicket.id)) return prev;
        return [newTicket, ...prev];
      });
      // Refresh count badges
      fetchTickets();
    });

    // 2. ticket:updated
    const unUpdated = onSocketEvent('ticket:updated', (updatedTicket) => {
      setTickets((prev) =>
        prev.map((t) => (t.id === updatedTicket.id ? { ...t, ...updatedTicket } : t))
      );
      setSelectedTicket((prev) =>
        prev?.id === updatedTicket.id ? { ...prev, ...updatedTicket } : prev
      );
      fetchTickets();
    });

    // 3. message:new
    const unMessage = onSocketEvent('message:new', ({ message, ticketId }) => {
      // If currently viewing this ticket, append message
      if (ticketId === selectedTicketId) {
        setMessages((prev) => {
          const isDup = prev.some(
            (m) =>
              (message.id && m.id === message.id) ||
              (message.clientMessageId && m.clientMessageId === message.clientMessageId)
          );
          if (isDup) {
            return prev.map((m) =>
              (m.clientMessageId && m.clientMessageId === message.clientMessageId) ||
              (m.id && m.id === message.id)
                ? { ...m, ...message, status: 'sent' }
                : m
            );
          }
          return [...prev, { ...message, status: 'sent' }];
        });
      }

      // Update snippet and lastMessageAt in ticket list and sort
      setTickets((prev) => {
        const updated = prev.map((t) => {
          if (t.id === ticketId) {
            return {
              ...t,
              lastMessage: {
                body: message.body,
                senderType: message.senderType,
                createdAt: message.createdAt,
              },
              lastMessageAt: message.createdAt,
            };
          }
          return t;
        });
        return [...updated].sort(
          (a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0)
        );
      });
    });

    // 4. On connect/reconnect: reload tickets, sync active ticket, flush pending queue
    const unConnect = onSocketEvent('connect', async () => {
      fetchTickets();

      if (selectedTicketId) {
        const lastId = messages.reduce((max, m) => (m.id && m.id > max ? m.id : max), 0);
        const res = await requestSync([{ ticketId: selectedTicketId, lastMessageId: lastId }]);
        if (res?.ok && Array.isArray(res.messages) && res.messages.length > 0) {
          setMessages((prev) => deduplicateMessages([...prev, ...res.messages]));
        }
      }

      flushPendingQueue();
    });

    return () => {
      unCreated();
      unUpdated();
      unMessage();
      unConnect();
    };
  }, [selectedTicketId, messages, fetchTickets, flushPendingQueue]);

  const value = {
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    tickets,
    counts,
    loadingTickets,
    selectedTicketId,
    setSelectedTicketId,
    selectedTicket,
    messages,
    events,
    loadingDetail,
    sendMessage,
    discardMessage,
    reloadTickets: fetchTickets,
    reloadDetail: () => loadTicketDetail(selectedTicketId),
  };

  return <TicketsContext.Provider value={value}>{children}</TicketsContext.Provider>;
}

export function useTickets() {
  const context = useContext(TicketsContext);
  if (!context) {
    throw new Error('useTickets must be used within a TicketsProvider');
  }
  return context;
}
