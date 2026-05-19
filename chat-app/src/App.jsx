import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import './App.css'

const MESSAGES_TABLE = 'messages'
const ROOM_CHANNEL = 'main-chat-room'

function formatTime(value) {
  if (!value) {
    return '--:--'
  }

  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function toHandle(email, fallbackId) {
  if (email) {
    return email.split('@')[0]
  }

  if (!fallbackId) {
    return 'User'
  }

  return `user-${fallbackId.slice(0, 6)}`
}

function AuthPage({ onAuthError }) {
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    setNotice('')
    onAuthError('')

    const credentials = {
      email: email.trim(),
      password,
    }

    let result

    if (mode === 'signup') {
      result = await supabase.auth.signUp(credentials)
    } else {
      result = await supabase.auth.signInWithPassword(credentials)
    }

    if (result.error) {
      onAuthError(result.error.message)
      setLoading(false)
      return
    }

    if (mode === 'signup' && !result.data.session) {
      setNotice('Signup complete. Check your email to confirm your account.')
      setLoading(false)
      return
    }

    setLoading(false)
    navigate('/chat', { replace: true })
  }

  return (
    <section className="auth-page">
      <article className="auth-card">
        <p className="eyebrow">Supabase + React</p>
        <h1>Realtime Chat App</h1>
        <p className="subtitle">
          Email authentication, live messages, typing indicator, online presence,
          and edit/delete controls.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              placeholder="you@example.com"
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              placeholder="At least 6 characters"
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? 'Please wait...' : mode === 'signup' ? 'Create account' : 'Login'}
          </button>
        </form>

        <button
          type="button"
          className="ghost-btn"
          onClick={() => {
            setMode((prev) => (prev === 'signup' ? 'login' : 'signup'))
            setNotice('')
            onAuthError('')
          }}
        >
          {mode === 'signup'
            ? 'Already have an account? Login'
            : 'Need an account? Sign up'}
        </button>

        {notice ? <p className="notice-text">{notice}</p> : null}
      </article>
    </section>
  )
}

function ChatPage({ user, onLogout, onChatError }) {
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [loadingMessages, setLoadingMessages] = useState(true)
  const [sending, setSending] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState([])
  const [typingUsers, setTypingUsers] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [editingText, setEditingText] = useState('')

  const bottomAnchorRef = useRef(null)
  const channelRef = useRef(null)
  const typingTimerRef = useRef(null)
  const pollTimerRef = useRef(null)

  const onlineUserMap = useMemo(() => {
    const nextMap = new Map()

    onlineUsers.forEach((entry) => {
      nextMap.set(entry.userId, entry)
    })

    return nextMap
  }, [onlineUsers])

  useEffect(() => {
    bottomAnchorRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    })
  }, [messages])

  useEffect(() => {
    let isMounted = true

    function syncPresence(channel) {
      const rawState = channel.presenceState()
      const flattenedState = Object.entries(rawState)
        .flatMap(([presenceKey, entryValue]) => {
          const metas = Array.isArray(entryValue)
            ? entryValue
            : Array.isArray(entryValue?.metas)
              ? entryValue.metas
              : entryValue && typeof entryValue === 'object'
                ? Object.values(entryValue)
                : []

          if (!metas.length) {
            return [
              {
                userId: presenceKey,
                email: undefined,
                typing: false,
              },
            ]
          }

          return metas.map((meta) => ({
            userId: meta.user_id ?? presenceKey,
            email: meta.email,
            typing: Boolean(meta.typing),
          }))
        })
        .filter((entry) => entry.userId)

      const merged = []
      const seen = new Map()

      flattenedState.forEach((entry) => {
        if (!seen.has(entry.userId)) {
          seen.set(entry.userId, merged.length)
          merged.push(entry)
          return
        }

        const existingIndex = seen.get(entry.userId)
        const existingEntry = merged[existingIndex]

        if (entry.typing && !existingEntry.typing) {
          merged[existingIndex] = {
            ...existingEntry,
            typing: true,
          }
        }
      })

      setOnlineUsers(merged)
      setTypingUsers(merged.filter((entry) => entry.typing && entry.userId !== user.id))
    }

    async function trackPresence(channel) {
      let status = await channel.track({
        user_id: user.id,
        email: user.email,
        typing: false,
      })

      if (status === 'ok') {
        return 'ok'
      }

      await new Promise((resolve) => {
        setTimeout(resolve, 300)
      })

      status = await channel.track({
        user_id: user.id,
        email: user.email,
        typing: false,
      })

      return status
    }

    async function fetchMessages({ showLoader = false, silent = false } = {}) {
      if (showLoader) {
        setLoadingMessages(true)
      }

      if (!silent) {
        onChatError('')
      }

      const { data, error } = await supabase
        .from(MESSAGES_TABLE)
        .select('*')
        .order('created_at', { ascending: true })

      if (!isMounted) {
        return
      }

      if (error && !silent) {
        onChatError(error.message)
      }

      if (!error) {
        setMessages(data ?? [])
      }

      if (showLoader) {
        setLoadingMessages(false)
      }
    }

    fetchMessages({ showLoader: true })

    pollTimerRef.current = setInterval(() => {
      fetchMessages({ silent: true })
    }, 2500)

    const channel = supabase
      .channel(ROOM_CHANNEL, {
        config: {
          presence: {
            key: user.id,
          },
        },
      })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: MESSAGES_TABLE },
        ({ new: nextMessage }) => {
          setMessages((prev) => {
            if (prev.some((message) => message.id === nextMessage.id)) {
              return prev
            }

            return [...prev, nextMessage]
          })
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: MESSAGES_TABLE },
        ({ new: nextMessage }) => {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === nextMessage.id ? nextMessage : message,
            ),
          )
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: MESSAGES_TABLE },
        ({ old: removedMessage }) => {
          setMessages((prev) =>
            prev.filter((message) => message.id !== removedMessage.id),
          )
        },
      )
      .on('presence', { event: 'sync' }, () => syncPresence(channel))
      .on('presence', { event: 'join' }, () => syncPresence(channel))
      .on('presence', { event: 'leave' }, () => syncPresence(channel))

    channel.subscribe(async (status) => {
      if (status === 'CHANNEL_ERROR') {
        onChatError('Realtime connection failed. Check Supabase Realtime settings.')
        return
      }

      if (status !== 'SUBSCRIBED') {
        return
      }

      const trackStatus = await trackPresence(channel)

      if (trackStatus !== 'ok') {
        setOnlineUsers((prev) => {
          if (prev.some((entry) => entry.userId === user.id)) {
            return prev
          }

          return [
            ...prev,
            {
              userId: user.id,
              email: user.email,
              typing: false,
            },
          ]
        })

        onChatError('Presence tracking failed. Refresh and try again.')
        return
      }

      syncPresence(channel)
    })

    channelRef.current = channel

    return () => {
      isMounted = false
      clearTimeout(typingTimerRef.current)
      clearInterval(pollTimerRef.current)

      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [onChatError, user.email, user.id])

  function updateTypingStatus(isTyping) {
    const channel = channelRef.current

    if (!channel) {
      return
    }

    channel.track({
      user_id: user.id,
      email: user.email,
      typing: isTyping,
    })
  }

  function handleDraftChange(event) {
    const nextDraft = event.target.value
    setDraft(nextDraft)

    clearTimeout(typingTimerRef.current)

    if (!nextDraft.trim()) {
      updateTypingStatus(false)
      return
    }

    updateTypingStatus(true)
    typingTimerRef.current = setTimeout(() => {
      updateTypingStatus(false)
    }, 1000)
  }

  async function handleSendMessage(event) {
    event.preventDefault()

    const content = draft.trim()

    if (!content || sending) {
      return
    }

    onChatError('')
    setSending(true)

    const { data, error } = await supabase
      .from(MESSAGES_TABLE)
      .insert([
        {
          user_id: user.id,
          content,
        },
      ])
      .select()
      .single()

    if (error) {
      onChatError(error.message)
      setSending(false)
      return
    }

    setMessages((prev) => {
      if (prev.some((message) => message.id === data.id)) {
        return prev
      }

      return [...prev, data]
    })

    setDraft('')
    setSending(false)
    updateTypingStatus(false)
  }

  async function handleDeleteMessage(id) {
    onChatError('')
    const previousMessages = messages

    setMessages((prev) => prev.filter((message) => message.id !== id))

    const { error } = await supabase
      .from(MESSAGES_TABLE)
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      setMessages(previousMessages)
      onChatError(error.message)
    }
  }

  function startEditMessage(message) {
    setEditingId(message.id)
    setEditingText(message.content)
  }

  function cancelEditMessage() {
    setEditingId(null)
    setEditingText('')
  }

  async function saveEditMessage(id) {
    const content = editingText.trim()

    if (!content) {
      return
    }

    onChatError('')
    const { data, error } = await supabase
      .from(MESSAGES_TABLE)
      .update({
        content,
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      onChatError(error.message)
      return
    }

    setMessages((prev) =>
      prev.map((message) => (message.id === data.id ? data : message)),
    )
    cancelEditMessage()
  }

  const typingLabel =
    typingUsers.length > 0
      ? `${typingUsers.map((entry) => toHandle(entry.email, entry.userId)).join(', ')} ${
          typingUsers.length > 1 ? 'are' : 'is'
        } typing...`
      : ''

  return (
    <section className="chat-page">
      <aside className="chat-sidebar">
        <div className="sidebar-panel">
          <p className="eyebrow">Signed in as</p>
          <h2>{toHandle(user.email, user.id)}</h2>
          <p className="muted-text">{user.email}</p>
        </div>

        <div className="sidebar-panel">
          <p className="eyebrow">Online users</p>
          <h3>{onlineUsers.length}</h3>
          <div className="online-list">
            {onlineUsers.length === 0 ? (
              <p className="muted-text">No one online yet.</p>
            ) : (
              onlineUsers.map((entry) => (
                <span key={entry.userId} className="online-chip">
                  {toHandle(entry.email, entry.userId)}
                </span>
              ))
            )}
          </div>
        </div>

        <button className="danger-btn" type="button" onClick={onLogout}>
          Logout
        </button>
      </aside>

      <main className="chat-main">
        <header className="chat-header">
          <div>
            <p className="eyebrow">Global Room</p>
            <h2>Live Messages</h2>
          </div>
          <p className="muted-text">Realtime with Supabase channels</p>
        </header>

        <section className="message-stream">
          {loadingMessages ? (
            <p className="status-text">Loading messages...</p>
          ) : messages.length === 0 ? (
            <p className="status-text">No messages yet. Send the first one.</p>
          ) : (
            messages.map((message) => {
              const mine = message.user_id === user.id
              const sender = mine
                ? 'You'
                : toHandle(
                    onlineUserMap.get(message.user_id)?.email,
                    message.user_id,
                  )

              return (
                <article
                  key={message.id}
                  className={`message-card ${mine ? 'my-message' : 'other-message'}`}
                >
                  <div className="message-meta">
                    <strong>{sender}</strong>
                    <time>{formatTime(message.created_at)}</time>
                  </div>

                  {editingId === message.id ? (
                    <div className="edit-wrap">
                      <input
                        value={editingText}
                        onChange={(event) => setEditingText(event.target.value)}
                        maxLength={500}
                      />
                      <div className="message-actions">
                        <button
                          type="button"
                          className="action-btn"
                          onClick={() => saveEditMessage(message.id)}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="action-btn"
                          onClick={cancelEditMessage}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="message-content">{message.content}</p>
                      {mine ? (
                        <div className="message-actions">
                          <button
                            type="button"
                            className="action-btn"
                            onClick={() => startEditMessage(message)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="action-btn danger-action"
                            onClick={() => handleDeleteMessage(message.id)}
                          >
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </>
                  )}
                </article>
              )
            })
          )}
          <div ref={bottomAnchorRef} />
        </section>

        <div className="typing-bar">{typingLabel || ' '}</div>

        <form className="composer" onSubmit={handleSendMessage}>
          <input
            type="text"
            value={draft}
            maxLength={500}
            placeholder="Write a message..."
            onChange={handleDraftChange}
          />
          <button type="submit" className="primary-btn" disabled={sending}>
            {sending ? 'Sending...' : 'Send'}
          </button>
        </form>
      </main>
    </section>
  )
}

function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    async function bootstrapSession() {
      setAuthLoading(true)
      const { data, error } = await supabase.auth.getUser()

      if (!isMounted) {
        return
      }

      if (error) {
        setErrorMessage(error.message)
      }

      setUser(data.user ?? null)
      setAuthLoading(false)
    }

    bootstrapSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function handleLogout() {
    const { error } = await supabase.auth.signOut()

    if (error) {
      setErrorMessage(error.message)
      return
    }

    setUser(null)
  }

  if (authLoading) {
    return (
      <div className="loader-page">
        <div className="loader-card">Checking your session...</div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <div className="ambient-shape ambient-one" />
      <div className="ambient-shape ambient-two" />

      {errorMessage ? (
        <p className="error-banner" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <Routes>
        <Route
          path="/"
          element={<Navigate to={user ? '/chat' : '/auth'} replace />}
        />
        <Route
          path="/auth"
          element={user ? <Navigate to="/chat" replace /> : <AuthPage onAuthError={setErrorMessage} />}
        />
        <Route
          path="/chat"
          element={
            user ? (
              <ChatPage
                user={user}
                onLogout={handleLogout}
                onChatError={setErrorMessage}
              />
            ) : (
              <Navigate to="/auth" replace />
            )
          }
        />
        <Route
          path="*"
          element={<Navigate to={user ? '/chat' : '/auth'} replace />}
        />
      </Routes>
    </div>
  )
}

export default App
