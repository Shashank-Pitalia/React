import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const STORAGE_KEYS = {
  transactions: 'expense-orbit.transactions',
  settings: 'expense-orbit.settings',
}

const COMMON_CATEGORIES = [
  'Salary',
  'Freelance',
  'Bonus',
  'Investments',
  'Gift',
  'Groceries',
  'Rent',
  'Transport',
  'Bills',
  'Dining',
  'Shopping',
  'Health',
  'Travel',
  'Education',
  'Entertainment',
  'Savings',
  'Subscriptions',
  'Other',
]

const CURRENCY_OPTIONS = ['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'AED']

const SORT_OPTIONS = [
  { value: 'recent', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'amount-desc', label: 'Highest amount' },
  { value: 'amount-asc', label: 'Lowest amount' },
  { value: 'title', label: 'Title A-Z' },
]

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function toDateInputValue(date = new Date()) {
  const timezoneOffset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 10)
}

function todayMinus(days) {
  const nextDate = new Date()
  nextDate.setDate(nextDate.getDate() - days)
  return toDateInputValue(nextDate)
}

function currentMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthKey(value) {
  if (typeof value !== 'string' || value.length < 7) {
    return ''
  }

  return value.slice(0, 7)
}

function formatMonthLabel(value) {
  if (!value || value === 'all') {
    return 'All time'
  }

  const [yearPart, monthPart] = value.split('-').map(Number)

  if (!yearPart || !monthPart) {
    return value
  }

  return new Date(yearPart, monthPart - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

function formatDateLabel(value) {
  if (!value) {
    return '--'
  }

  const date = new Date(`${value}T00:00:00`)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatMoney(value, currency) {
  const amount = Number(value)

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0)
}

function formatSignedMoney(value, currency, type) {
  const symbol = type === 'income' ? '+' : '-'
  return `${symbol}${formatMoney(value, currency)}`
}

function formatPercent(value) {
  if (!Number.isFinite(value)) {
    return '0%'
  }

  const rounded = Math.abs(value) < 0.1 ? 0 : value
  return `${rounded.toFixed(1)}%`
}

function safeParseJSON(raw, fallback) {
  if (!raw) {
    return fallback
  }

  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function escapeCsvValue(value) {
  const text = String(value ?? '')

  if (/[,"\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }

  return text
}

function buildDemoTransactions() {
  return [
    {
      id: createId(),
      title: 'Salary credit',
      amount: 82000,
      type: 'income',
      category: 'Salary',
      date: todayMinus(2),
      note: 'Main monthly paycheck',
      recurring: true,
    },
    {
      id: createId(),
      title: 'Freelance sprint',
      amount: 14000,
      type: 'income',
      category: 'Freelance',
      date: todayMinus(6),
      note: 'Landing page redesign',
      recurring: false,
    },
    {
      id: createId(),
      title: 'House rent',
      amount: 18000,
      type: 'expense',
      category: 'Rent',
      date: todayMinus(4),
      note: 'Monthly apartment rent',
      recurring: true,
    },
    {
      id: createId(),
      title: 'Groceries',
      amount: 6300,
      type: 'expense',
      category: 'Groceries',
      date: todayMinus(1),
      note: 'Stocked up for the week',
      recurring: true,
    },
    {
      id: createId(),
      title: 'Metro pass',
      amount: 1200,
      type: 'expense',
      category: 'Transport',
      date: todayMinus(8),
      note: 'Commuting top up',
      recurring: true,
    },
    {
      id: createId(),
      title: 'Utilities bundle',
      amount: 3900,
      type: 'expense',
      category: 'Bills',
      date: todayMinus(11),
      note: 'Electricity and internet',
      recurring: true,
    },
    {
      id: createId(),
      title: 'Team dinner',
      amount: 2300,
      type: 'expense',
      category: 'Dining',
      date: todayMinus(12),
      note: 'Celebrated launch day',
      recurring: false,
    },
    {
      id: createId(),
      title: 'Dividend payout',
      amount: 3600,
      type: 'income',
      category: 'Investments',
      date: todayMinus(18),
      note: 'Quarterly passive income',
      recurring: false,
    },
    {
      id: createId(),
      title: 'Online course',
      amount: 4500,
      type: 'expense',
      category: 'Education',
      date: todayMinus(22),
      note: 'React advanced patterns',
      recurring: false,
    },
  ].sort((left, right) => Date.parse(right.date) - Date.parse(left.date))
}

function normalizeTransaction(transaction) {
  const amount = Number(transaction?.amount)
  const category = typeof transaction?.category === 'string' ? transaction.category.trim() : ''
  const title = typeof transaction?.title === 'string' ? transaction.title.trim() : ''
  const note = typeof transaction?.note === 'string' ? transaction.note.trim() : ''

  return {
    id: typeof transaction?.id === 'string' && transaction.id.trim() ? transaction.id : createId(),
    title: title || 'Untitled transaction',
    amount: Number.isFinite(amount) ? Math.abs(amount) : 0,
    type: transaction?.type === 'income' ? 'income' : 'expense',
    category: category || (transaction?.type === 'income' ? 'Salary' : 'Groceries'),
    date: typeof transaction?.date === 'string' && transaction.date ? transaction.date : toDateInputValue(),
    note,
    recurring: Boolean(transaction?.recurring),
  }
}

function cleanTransactionList(list) {
  if (!Array.isArray(list)) {
    return []
  }

  return list
    .map(normalizeTransaction)
    .filter((transaction) => transaction.amount > 0 && transaction.title.trim())
}

function compareTransactions(left, right, sortBy) {
  switch (sortBy) {
    case 'oldest':
      return Date.parse(left.date) - Date.parse(right.date)
    case 'amount-desc':
      return right.amount - left.amount
    case 'amount-asc':
      return left.amount - right.amount
    case 'title':
      return left.title.localeCompare(right.title)
    default:
      return Date.parse(right.date) - Date.parse(left.date)
  }
}

function getInitialTransactions() {
  if (typeof window === 'undefined') {
    return buildDemoTransactions()
  }

  const stored = safeParseJSON(window.localStorage.getItem(STORAGE_KEYS.transactions), null)

  if (Array.isArray(stored)) {
    return cleanTransactionList(stored)
  }

  return buildDemoTransactions()
}

function getInitialSettings() {
  const fallback = {
    theme: 'light',
    currency: 'INR',
    budget: 60000,
  }

  if (typeof window === 'undefined') {
    return fallback
  }

  const stored = safeParseJSON(window.localStorage.getItem(STORAGE_KEYS.settings), null)

  if (!stored || typeof stored !== 'object') {
    return fallback
  }

  const currency = typeof stored.currency === 'string' && CURRENCY_OPTIONS.includes(stored.currency)
    ? stored.currency
    : fallback.currency

  const budgetValue = Number(stored.budget)

  return {
    theme: stored.theme === 'dark' ? 'dark' : 'light',
    currency,
    budget: Number.isFinite(budgetValue) && budgetValue >= 0 ? budgetValue : fallback.budget,
  }
}

function createEmptyForm() {
  return {
    title: '',
    amount: '',
    type: 'expense',
    category: 'Groceries',
    date: toDateInputValue(),
    note: '',
    recurring: false,
  }
}

function groupCategoryTotals(transactions) {
  const categoryMap = new Map()

  transactions.forEach((transaction) => {
    if (transaction.type !== 'expense') {
      return
    }

    const previous = categoryMap.get(transaction.category) || 0
    categoryMap.set(transaction.category, previous + transaction.amount)
  })

  return Array.from(categoryMap.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((left, right) => right.amount - left.amount)
}

function groupMonthlyTotals(transactions) {
  const monthlyMap = new Map()

  transactions.forEach((transaction) => {
    const key = monthKey(transaction.date)
    if (!key) {
      return
    }

    const bucket = monthlyMap.get(key) || { month: key, income: 0, expense: 0 }

    if (transaction.type === 'income') {
      bucket.income += transaction.amount
    } else {
      bucket.expense += transaction.amount
    }

    monthlyMap.set(key, bucket)
  })

  return Array.from(monthlyMap.values())
    .sort((left, right) => left.month.localeCompare(right.month))
    .slice(-6)
}

function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function MetricCard({ label, value, detail, tone = 'neutral' }) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <p>{detail}</p> : null}
    </article>
  )
}

function App() {
  const [transactions, setTransactions] = useState(() => getInitialTransactions())
  const [settings, setSettings] = useState(() => getInitialSettings())
  const [form, setForm] = useState(() => createEmptyForm())
  const [editingId, setEditingId] = useState(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState(currentMonthKey())
  const [sortBy, setSortBy] = useState('recent')
  const [statusMessage, setStatusMessage] = useState('')

  const fileInputRef = useRef(null)
  const statusTimerRef = useRef(null)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(transactions))
  }, [transactions])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    return () => {
      if (statusTimerRef.current) {
        clearTimeout(statusTimerRef.current)
      }
    }
  }, [])

  const allCategories = useMemo(() => {
    const categorySet = new Set(COMMON_CATEGORIES)

    transactions.forEach((transaction) => {
      if (transaction.category) {
        categorySet.add(transaction.category)
      }
    })

    return Array.from(categorySet).sort((left, right) => left.localeCompare(right))
  }, [transactions])

  const availableMonths = useMemo(() => {
    const monthSet = new Set([currentMonthKey()])

    transactions.forEach((transaction) => {
      const key = monthKey(transaction.date)
      if (key) {
        monthSet.add(key)
      }
    })

    return Array.from(monthSet).sort((left, right) => right.localeCompare(left))
  }, [transactions])

  const monthScopeTransactions = useMemo(() => {
    if (monthFilter === 'all') {
      return transactions
    }

    return transactions.filter((transaction) => monthKey(transaction.date) === monthFilter)
  }, [monthFilter, transactions])

  const visibleTransactions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return monthScopeTransactions
      .filter((transaction) => {
        const matchesSearch =
          !normalizedSearch ||
          [transaction.title, transaction.category, transaction.note, transaction.amount.toString()]
            .join(' ')
            .toLowerCase()
            .includes(normalizedSearch)

        const matchesType = typeFilter === 'all' || transaction.type === typeFilter
        const matchesCategory = categoryFilter === 'all' || transaction.category === categoryFilter

        return matchesSearch && matchesType && matchesCategory
      })
      .slice()
      .sort((left, right) => compareTransactions(left, right, sortBy))
  }, [categoryFilter, monthScopeTransactions, search, sortBy, typeFilter])

  const categoryBreakdown = useMemo(() => groupCategoryTotals(monthScopeTransactions), [monthScopeTransactions])

  const monthlyTrend = useMemo(() => groupMonthlyTotals(transactions), [transactions])

  const selectedBudget = Number.isFinite(Number(settings.budget)) ? Number(settings.budget) : 0

  const dashboardStats = useMemo(() => {
    const incomeTotal = monthScopeTransactions
      .filter((transaction) => transaction.type === 'income')
      .reduce((sum, transaction) => sum + transaction.amount, 0)

    const expenseTotal = monthScopeTransactions
      .filter((transaction) => transaction.type === 'expense')
      .reduce((sum, transaction) => sum + transaction.amount, 0)

    const balance = incomeTotal - expenseTotal
    const savingsRate = incomeTotal > 0 ? (balance / incomeTotal) * 100 : 0
    const budgetUsed = selectedBudget > 0 ? (expenseTotal / selectedBudget) * 100 : 0
    const budgetRemaining = selectedBudget - expenseTotal
    const recurringCount = monthScopeTransactions.filter((transaction) => transaction.recurring).length
    const averageExpense =
      expenseTotal > 0 ? expenseTotal / Math.max(1, monthScopeTransactions.filter((transaction) => transaction.type === 'expense').length) : 0
    const biggestExpense = monthScopeTransactions
      .filter((transaction) => transaction.type === 'expense')
      .sort((left, right) => right.amount - left.amount)[0]
    const topCategory = categoryBreakdown[0] || null

    return {
      incomeTotal,
      expenseTotal,
      balance,
      savingsRate,
      budgetUsed,
      budgetRemaining,
      recurringCount,
      averageExpense,
      biggestExpense,
      topCategory,
    }
  }, [categoryBreakdown, monthScopeTransactions, selectedBudget])

  const visibleTransactionCount = visibleTransactions.length
  const hasActiveFilters =
    search.trim() !== '' || typeFilter !== 'all' || categoryFilter !== 'all' || monthFilter !== 'all' || sortBy !== 'recent'
  const selectedMonthLabel = formatMonthLabel(monthFilter)

  function flash(message) {
    setStatusMessage(message)

    if (statusTimerRef.current) {
      clearTimeout(statusTimerRef.current)
    }

    statusTimerRef.current = setTimeout(() => {
      setStatusMessage('')
    }, 3200)
  }

  function resetForm() {
    setEditingId(null)
    setForm(createEmptyForm())
  }

  function handleSubmit(event) {
    event.preventDefault()

    const title = form.title.trim()
    const amount = Math.abs(Number(form.amount))
    const category = form.category.trim()
    const note = form.note.trim()

    if (!title || !Number.isFinite(amount) || amount <= 0) {
      flash('Add a valid title and amount before saving.')
      return
    }

    const normalizedTransaction = {
      id: editingId || createId(),
      title,
      amount,
      type: form.type,
      category: category || (form.type === 'income' ? 'Salary' : 'Groceries'),
      date: form.date || toDateInputValue(),
      note,
      recurring: form.recurring,
    }

    setTransactions((currentTransactions) => {
      if (editingId) {
        return currentTransactions.map((transaction) =>
          transaction.id === editingId ? normalizedTransaction : transaction,
        )
      }

      return [normalizedTransaction, ...currentTransactions]
    })

    flash(editingId ? 'Transaction updated successfully.' : 'Transaction added successfully.')
    resetForm()
  }

  function handleEdit(transaction) {
    setEditingId(transaction.id)
    setForm({
      title: transaction.title,
      amount: String(transaction.amount),
      type: transaction.type,
      category: transaction.category,
      date: transaction.date,
      note: transaction.note || '',
      recurring: Boolean(transaction.recurring),
    })
    flash(`Editing ${transaction.title}.`)
  }

  function handleDelete(transactionId) {
    const targetTransaction = transactions.find((transaction) => transaction.id === transactionId)

    if (!targetTransaction) {
      return
    }

    if (typeof window !== 'undefined' && !window.confirm(`Delete ${targetTransaction.title}?`)) {
      return
    }

    setTransactions((currentTransactions) => currentTransactions.filter((transaction) => transaction.id !== transactionId))

    if (editingId === transactionId) {
      resetForm()
    }

    flash('Transaction deleted.')
  }

  function handleDuplicate(transaction) {
    const duplicate = {
      ...transaction,
      id: createId(),
      title: `${transaction.title} copy`,
      date: toDateInputValue(),
    }

    setTransactions((currentTransactions) => [duplicate, ...currentTransactions])
    flash(`Duplicated ${transaction.title}.`)
  }

  function handleLoadDemoData() {
    if (transactions.length > 0 && typeof window !== 'undefined') {
      const shouldReplace = window.confirm('Replace your current transactions with the demo data?')

      if (!shouldReplace) {
        return
      }
    }

    setTransactions(buildDemoTransactions())
    setMonthFilter(currentMonthKey())
    setTypeFilter('all')
    setCategoryFilter('all')
    setSortBy('recent')
    flash('Demo data loaded.')
  }

  function handleClearAll() {
    if (transactions.length === 0) {
      flash('Nothing to clear.')
      return
    }

    if (typeof window !== 'undefined' && !window.confirm('Clear every transaction from this dashboard?')) {
      return
    }

    setTransactions([])
    resetForm()
    flash('All transactions cleared.')
  }

  function handleExportCsv() {
    if (transactions.length === 0) {
      flash('Add transactions before exporting CSV.')
      return
    }

    const header = ['Date', 'Title', 'Type', 'Category', 'Amount', 'Recurring', 'Note']
    const rows = transactions.map((transaction) => [
      transaction.date,
      transaction.title,
      transaction.type,
      transaction.category,
      transaction.amount,
      transaction.recurring ? 'Yes' : 'No',
      transaction.note || '',
    ])

    const csv = [header, ...rows]
      .map((row) => row.map(escapeCsvValue).join(','))
      .join('\n')

    downloadTextFile('expense-orbit-export.csv', csv, 'text/csv;charset=utf-8;')
    flash('CSV export downloaded.')
  }

  function handleExportJson() {
    if (transactions.length === 0) {
      flash('Add transactions before exporting JSON.')
      return
    }

    const json = JSON.stringify(transactions, null, 2)
    downloadTextFile('expense-orbit-export.json', json, 'application/json;charset=utf-8;')
    flash('JSON export downloaded.')
  }

  async function handleImportFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    try {
      const text = await file.text()
      const parsed = safeParseJSON(text, null)

      if (!Array.isArray(parsed)) {
        throw new Error('Invalid file format')
      }

      const importedTransactions = cleanTransactionList(parsed).map((transaction) => ({
        ...transaction,
        id: createId(),
      }))

      if (importedTransactions.length === 0) {
        flash('No usable transactions were found in the file.')
        return
      }

      if (transactions.length > 0 && typeof window !== 'undefined') {
        const shouldReplace = window.confirm('Importing will replace the current dashboard data. Continue?')

        if (!shouldReplace) {
          return
        }
      }

      setTransactions(importedTransactions)
      setMonthFilter(currentMonthKey())
      setTypeFilter('all')
      setCategoryFilter('all')
      setSortBy('recent')
      flash(`Imported ${importedTransactions.length} transactions.`)
    } catch {
      flash('Import failed. Use a valid JSON export file.')
    }
  }

  function handleThemeToggle() {
    setSettings((currentSettings) => ({
      ...currentSettings,
      theme: currentSettings.theme === 'dark' ? 'light' : 'dark',
    }))
  }

  function handleBudgetChange(event) {
    const nextValue = event.target.value === '' ? 0 : Number(event.target.value)

    if (Number.isNaN(nextValue)) {
      return
    }

    setSettings((currentSettings) => ({
      ...currentSettings,
      budget: Math.max(0, nextValue),
    }))
  }

  function handleCurrencyChange(event) {
    setSettings((currentSettings) => ({
      ...currentSettings,
      currency: event.target.value,
    }))
  }

  function clearFilters() {
    setSearch('')
    setTypeFilter('all')
    setCategoryFilter('all')
    setMonthFilter(currentMonthKey())
    setSortBy('recent')
    flash('Filters reset.')
  }

  const budgetPercent = selectedBudget > 0 ? Math.max(0, Math.min(100, (dashboardStats.expenseTotal / selectedBudget) * 100)) : 0
  const budgetLabel =
    selectedBudget > 0
      ? dashboardStats.budgetRemaining >= 0
        ? `${formatMoney(dashboardStats.budgetRemaining, settings.currency)} left`
        : `${formatMoney(Math.abs(dashboardStats.budgetRemaining), settings.currency)} over budget`
      : 'Set a monthly budget to unlock progress tracking.'

  const currentScopeTitle =
    monthFilter === 'all'
      ? 'All time performance'
      : `${selectedMonthLabel} performance`

  return (
    <div className="app-shell" data-theme={settings.theme}>
      <div className="orb orb-a" />
      <div className="orb orb-b" />
      <main className="dashboard">
        <header className="hero">
          <div className="hero-copy panel">
            <div className="eyebrow-row">
              <span className="eyebrow">Expense Orbit</span>
              <span className="eyebrow-subtle">React expense tracker</span>
            </div>
            <h1>Track money with a dashboard that feels premium, fast, and calm.</h1>
            <p className="hero-text">
              Add income or expenses, set a monthly budget, filter the ledger by month or category,
              and keep everything saved in your browser. Export your data, import a backup, and
              switch the visual theme whenever you want.
            </p>

            <div className="hero-badges">
              <span>Local storage</span>
              <span>Budget guard</span>
              <span>CSV / JSON export</span>
              <span>Theme toggle</span>
            </div>

            <div className="hero-actions">
              <button type="button" className="button button-primary" onClick={handleLoadDemoData}>
                Load demo data
              </button>
              <button type="button" className="button button-secondary" onClick={handleExportCsv}>
                Export CSV
              </button>
              <button type="button" className="button button-secondary" onClick={handleThemeToggle}>
                {settings.theme === 'dark' ? 'Use light theme' : 'Use dark theme'}
              </button>
            </div>
          </div>

          <div className="hero-summary panel">
            <div className="hero-summary-top">
              <span>Net position</span>
              <strong>{formatMoney(dashboardStats.balance, settings.currency)}</strong>
              <p>{currentScopeTitle}</p>
            </div>

            <div className="hero-summary-grid">
              <article>
                <span>Income</span>
                <strong>{formatMoney(dashboardStats.incomeTotal, settings.currency)}</strong>
              </article>
              <article>
                <span>Expenses</span>
                <strong>{formatMoney(dashboardStats.expenseTotal, settings.currency)}</strong>
              </article>
              <article>
                <span>Budget usage</span>
                <strong>{selectedBudget > 0 ? `${budgetPercent.toFixed(0)}%` : 'Unset'}</strong>
              </article>
              <article>
                <span>Savings rate</span>
                <strong>{formatPercent(dashboardStats.savingsRate)}</strong>
              </article>
            </div>
          </div>
        </header>

        {statusMessage ? <div className="status-banner">{statusMessage}</div> : null}

        <section className="workspace-grid">
          <aside className="panel control-panel">
            <div className="section-heading">
              <div>
                <span className="section-kicker">Quick entry</span>
                <h2>{editingId ? 'Update a transaction' : 'Add a transaction'}</h2>
              </div>
              {editingId ? (
                <button type="button" className="text-button" onClick={resetForm}>
                  Cancel edit
                </button>
              ) : null}
            </div>

            <form className="transaction-form" onSubmit={handleSubmit}>
              <label className="field">
                <span>Title</span>
                <input
                  type="text"
                  value={form.title}
                  placeholder="Groceries, salary, rent, trip..."
                  onChange={(event) => setForm((currentForm) => ({ ...currentForm, title: event.target.value }))}
                  required
                />
              </label>

              <div className="form-row two-up">
                <label className="field">
                  <span>Amount</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    placeholder="1200"
                    onChange={(event) => setForm((currentForm) => ({ ...currentForm, amount: event.target.value }))}
                    required
                  />
                </label>

                <label className="field">
                  <span>Type</span>
                  <select
                    value={form.type}
                    onChange={(event) =>
                      setForm((currentForm) => ({
                        ...currentForm,
                        type: event.target.value,
                      }))
                    }
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </label>
              </div>

              <div className="form-row two-up">
                <label className="field">
                  <span>Category</span>
                  <input
                    list="expense-categories"
                    type="text"
                    value={form.category}
                    placeholder="Choose or type a category"
                    onChange={(event) => setForm((currentForm) => ({ ...currentForm, category: event.target.value }))}
                    required
                  />
                </label>

                <label className="field">
                  <span>Date</span>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(event) => setForm((currentForm) => ({ ...currentForm, date: event.target.value }))}
                    required
                  />
                </label>
              </div>

              <label className="field">
                <span>Note</span>
                <textarea
                  rows="3"
                  value={form.note}
                  placeholder="Optional details about the payment"
                  onChange={(event) => setForm((currentForm) => ({ ...currentForm, note: event.target.value }))}
                />
              </label>

              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={form.recurring}
                  onChange={(event) => setForm((currentForm) => ({ ...currentForm, recurring: event.target.checked }))}
                />
                <span>Mark as recurring</span>
              </label>

              <div className="form-actions">
                <button type="submit" className="button button-primary">
                  {editingId ? 'Update transaction' : 'Save transaction'}
                </button>
                <button type="button" className="button button-secondary" onClick={resetForm}>
                  Reset form
                </button>
              </div>
            </form>

            <datalist id="expense-categories">
              {allCategories.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>

            <div className="settings-panel">
              <div className="settings-grid">
                <label className="field compact">
                  <span>Monthly budget</span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={settings.budget}
                    onChange={handleBudgetChange}
                  />
                </label>

                <label className="field compact">
                  <span>Currency</span>
                  <select value={settings.currency} onChange={handleCurrencyChange}>
                    {CURRENCY_OPTIONS.map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                  </select>
                </label>

                <button type="button" className="theme-toggle" onClick={handleThemeToggle}>
                  <span>Theme</span>
                  <strong>{settings.theme === 'dark' ? 'Dark' : 'Light'}</strong>
                </button>
              </div>
              <p className="supporting-copy">
                Your transactions and preferences stay in this browser until you clear them.
              </p>
            </div>

            <div className="utility-grid">
              <button type="button" className="button button-secondary" onClick={handleExportCsv}>
                Export CSV
              </button>
              <button type="button" className="button button-secondary" onClick={handleExportJson}>
                Export JSON
              </button>
              <button type="button" className="button button-secondary" onClick={() => fileInputRef.current?.click()}>
                Import JSON
              </button>
              <button type="button" className="button button-danger" onClick={handleClearAll}>
                Clear all
              </button>
            </div>
          </aside>

          <section className="panel analytics-panel">
            <div className="section-heading">
              <div>
                <span className="section-kicker">Insights</span>
                <h2>{currentScopeTitle}</h2>
              </div>
              <span className="section-pill">{selectedMonthLabel}</span>
            </div>

            <div className="metric-grid">
              <MetricCard
                label="Balance"
                value={formatMoney(dashboardStats.balance, settings.currency)}
                detail={dashboardStats.balance >= 0 ? 'Positive cash flow' : 'Spending is ahead of income'}
                tone={dashboardStats.balance >= 0 ? 'income' : 'expense'}
              />
              <MetricCard
                label="Income"
                value={formatMoney(dashboardStats.incomeTotal, settings.currency)}
                detail={`${monthScopeTransactions.filter((transaction) => transaction.type === 'income').length} entries`}
                tone="income"
              />
              <MetricCard
                label="Expenses"
                value={formatMoney(dashboardStats.expenseTotal, settings.currency)}
                detail={`${monthScopeTransactions.filter((transaction) => transaction.type === 'expense').length} entries`}
                tone="expense"
              />
              <MetricCard
                label="Savings rate"
                value={formatPercent(dashboardStats.savingsRate)}
                detail={dashboardStats.savingsRate >= 0 ? 'Healthy margin' : 'Overspent this period'}
                tone={dashboardStats.savingsRate >= 0 ? 'accent' : 'expense'}
              />
            </div>

            <div className="snapshot-grid">
              <article className="snapshot-card budget-card">
                <div className="snapshot-head">
                  <span>Budget status</span>
                  <strong>{selectedBudget > 0 ? formatMoney(selectedBudget, settings.currency) : 'Unset'}</strong>
                </div>
                <div className="progress-track" aria-hidden="true">
                  <div className="progress-fill" style={{ width: `${budgetPercent}%` }} />
                </div>
                <p>{budgetLabel}</p>
              </article>

              <article className="snapshot-card spotlight-card">
                <div className="snapshot-head">
                  <span>Top category</span>
                  <strong>{dashboardStats.topCategory ? dashboardStats.topCategory.category : 'No expenses yet'}</strong>
                </div>
                <p>
                  {dashboardStats.topCategory
                    ? `${formatMoney(dashboardStats.topCategory.amount, settings.currency)} of spending`
                    : 'Add expenses to generate category insights.'}
                </p>
              </article>

              <article className="snapshot-card spotlight-card">
                <div className="snapshot-head">
                  <span>Recurring items</span>
                  <strong>{dashboardStats.recurringCount}</strong>
                </div>
                <p>Track subscriptions, rent, and monthly bills at a glance.</p>
              </article>

              <article className="snapshot-card spotlight-card">
                <div className="snapshot-head">
                  <span>Largest expense</span>
                  <strong>{dashboardStats.biggestExpense ? dashboardStats.biggestExpense.title : 'None yet'}</strong>
                </div>
                <p>
                  {dashboardStats.biggestExpense
                    ? formatMoney(dashboardStats.biggestExpense.amount, settings.currency)
                    : 'Your biggest transaction will appear here.'}
                </p>
              </article>
            </div>

            <div className="chart-grid">
              <article className="chart-card">
                <div className="chart-head">
                  <div>
                    <span className="section-kicker">Expenses by category</span>
                    <h3>Spending breakdown</h3>
                  </div>
                  <span>{categoryBreakdown.length} categories</span>
                </div>

                <div className="bar-list">
                  {categoryBreakdown.length > 0 ? (
                    categoryBreakdown.map((item) => {
                      const totalExpense = dashboardStats.expenseTotal || 1
                      const percent = Math.max(4, (item.amount / totalExpense) * 100)

                      return (
                        <div key={item.category} className="bar-row">
                          <div className="bar-meta">
                            <span>{item.category}</span>
                            <strong>{formatMoney(item.amount, settings.currency)}</strong>
                          </div>
                          <div className="bar-track small">
                            <div className="bar-fill expense" style={{ width: `${Math.min(percent, 100)}%` }} />
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <p className="empty-copy">No expense data yet. Add an expense to see the breakdown.</p>
                  )}
                </div>
              </article>

              <article className="chart-card">
                <div className="chart-head">
                  <div>
                    <span className="section-kicker">Recent history</span>
                    <h3>Monthly trend</h3>
                  </div>
                  <span>Last 6 months</span>
                </div>

                <div className="trend-list">
                  {monthlyTrend.length > 0 ? (
                    monthlyTrend.map((item) => {
                      const total = Math.max(item.income + item.expense, 1)
                      const incomeWidth = Math.max(4, (item.income / total) * 100)
                      const expenseWidth = Math.max(4, (item.expense / total) * 100)
                      const net = item.income - item.expense

                      return (
                        <div key={item.month} className="trend-row">
                          <div className="bar-meta">
                            <span>{formatMonthLabel(item.month)}</span>
                            <strong>{formatMoney(net, settings.currency)}</strong>
                          </div>
                          <div className="trend-bars">
                            <div className="trend-line">
                              <span>Income</span>
                              <div className="bar-track small">
                                <div className="bar-fill income" style={{ width: `${Math.min(incomeWidth, 100)}%` }} />
                              </div>
                              <strong>{formatMoney(item.income, settings.currency)}</strong>
                            </div>
                            <div className="trend-line">
                              <span>Expense</span>
                              <div className="bar-track small">
                                <div className="bar-fill expense" style={{ width: `${Math.min(expenseWidth, 100)}%` }} />
                              </div>
                              <strong>{formatMoney(item.expense, settings.currency)}</strong>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <p className="empty-copy">No monthly data yet. Load the demo portfolio to see the trend chart.</p>
                  )}
                </div>
              </article>
            </div>
          </section>
        </section>

        <section className="panel ledger-panel">
          <div className="section-heading ledger-heading">
            <div>
              <span className="section-kicker">Ledger</span>
              <h2>Transaction history</h2>
            </div>
            <div className="ledger-summary">
              <span>{visibleTransactionCount} shown</span>
              <span>{transactions.length} total</span>
            </div>
          </div>

          <div className="filter-bar">
            <label className="field compact search-field">
              <span>Search</span>
              <input
                type="search"
                value={search}
                placeholder="Find a payment, note, or amount"
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <label className="field compact">
              <span>Type</span>
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="all">All types</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </label>

            <label className="field compact">
              <span>Category</span>
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option value="all">All categories</option>
                {allCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label className="field compact">
              <span>Month</span>
              <select value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)}>
                <option value="all">All time</option>
                {availableMonths.map((month) => (
                  <option key={month} value={month}>
                    {formatMonthLabel(month)}
                  </option>
                ))}
              </select>
            </label>

            <label className="field compact">
              <span>Sort</span>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <button type="button" className="button button-secondary clear-filters" onClick={clearFilters}>
              Reset filters
            </button>
          </div>

          <div className="ledger-meta-row">
            <span>
              Showing {visibleTransactionCount} of {monthScopeTransactions.length} records in {selectedMonthLabel}
            </span>
            <span>{hasActiveFilters ? 'Filters are active' : 'No filters applied'}</span>
          </div>

          <div className="transaction-list">
            {visibleTransactions.length > 0 ? (
              visibleTransactions.map((transaction) => (
                <article key={transaction.id} className={`transaction-card ${transaction.type}`}>
                  <div className="transaction-main">
                    <div className="transaction-topline">
                      <div>
                        <h3>{transaction.title}</h3>
                        <p>{formatDateLabel(transaction.date)}</p>
                      </div>
                      <strong>{formatSignedMoney(transaction.amount, settings.currency, transaction.type)}</strong>
                    </div>

                    <div className="chip-row">
                      <span className={`chip chip-${transaction.type}`}>{transaction.type}</span>
                      <span className="chip chip-soft">{transaction.category}</span>
                      {transaction.recurring ? <span className="chip chip-soft">Recurring</span> : null}
                    </div>

                    {transaction.note ? <p className="transaction-note">{transaction.note}</p> : null}
                  </div>

                  <div className="transaction-actions">
                    <button type="button" className="text-button" onClick={() => handleDuplicate(transaction)}>
                      Duplicate
                    </button>
                    <button type="button" className="text-button" onClick={() => handleEdit(transaction)}>
                      Edit
                    </button>
                    <button type="button" className="text-button danger" onClick={() => handleDelete(transaction.id)}>
                      Delete
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <article className="empty-state">
                <h3>No matching transactions</h3>
                <p>
                  Try changing the search, filters, or month selection. You can also load the demo data to explore
                  the dashboard instantly.
                </p>
                <div className="empty-actions">
                  <button type="button" className="button button-primary" onClick={handleLoadDemoData}>
                    Load demo data
                  </button>
                  {hasActiveFilters ? (
                    <button type="button" className="button button-secondary" onClick={clearFilters}>
                      Reset filters
                    </button>
                  ) : null}
                </div>
              </article>
            )}
          </div>
        </section>
      </main>

      <input ref={fileInputRef} className="visually-hidden" type="file" accept="application/json" onChange={handleImportFile} />
    </div>
  )
}

export default App
