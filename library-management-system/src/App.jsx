import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const STORAGE_KEYS = {
  books: 'library-atlas.books',
  members: 'library-atlas.members',
  loans: 'library-atlas.loans',
  activity: 'library-atlas.activity',
  prefs: 'library-atlas.prefs',
}

const BOOK_GENRES = [
  'Literature',
  'Science',
  'Technology',
  'Business',
  'History',
  'Design',
  'Philosophy',
  'Biography',
  'Education',
  'Fantasy',
  'Mystery',
  'Poetry',
  'Children',
  'Research',
  'Reference',
]

const MEMBER_ROLES = ['Student', 'Faculty', 'Researcher', 'Guest', 'Librarian']

const BOOK_STATUS_OPTIONS = ['available', 'borrowed', 'reserved', 'lost', 'archived']

const BOOK_SORT_OPTIONS = [
  { value: 'recent', label: 'Recently updated' },
  { value: 'title', label: 'Title A-Z' },
  { value: 'author', label: 'Author A-Z' },
  { value: 'genre', label: 'Genre' },
  { value: 'rating', label: 'Highest rating' },
  { value: 'due-soon', label: 'Due soon' },
  { value: 'status', label: 'Status' },
]

const MEMBER_SORT_OPTIONS = [
  { value: 'recent', label: 'Recently added' },
  { value: 'name', label: 'Name A-Z' },
  { value: 'role', label: 'Role' },
  { value: 'loans', label: 'Most loans' },
  { value: 'fines', label: 'Highest fines' },
]

const CIRCULATION_MODES = [
  { value: 'issue', label: 'Issue' },
  { value: 'return', label: 'Return' },
  { value: 'reserve', label: 'Reserve' },
  { value: 'renew', label: 'Renew' },
]

const CURRENCY_OPTIONS = ['INR', 'USD', 'EUR', 'GBP', 'AUD']

const ACTIVITY_FILTER_OPTIONS = [
  { value: 'all', label: 'All activity' },
  { value: 'circulation', label: 'Circulation' },
  { value: 'catalog', label: 'Catalog' },
  { value: 'member', label: 'Members' },
  { value: 'system', label: 'System' },
]

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function parseDate(value) {
  if (!value) {
    return null
  }

  const parsed = new Date(`${value}T00:00:00`)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed
}

function todayValue(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

function addDays(value, days) {
  const parsed = parseDate(value) || new Date()
  parsed.setDate(parsed.getDate() + days)
  return todayValue(parsed)
}

function daysBetween(startValue, endValue) {
  const start = parseDate(startValue)
  const end = parseDate(endValue)

  if (!start || !end) {
    return 0
  }

  const msPerDay = 24 * 60 * 60 * 1000
  return Math.round((end.getTime() - start.getTime()) / msPerDay)
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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function hueFromText(text, offset = 0) {
  const total = Array.from(String(text || 'book')).reduce((sum, character) => sum + character.charCodeAt(0), 0)
  return (total + offset) % 360
}

function formatDate(value) {
  const parsed = parseDate(value)

  if (!parsed) {
    return '--'
  }

  return parsed.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatTimeAgo(value, reference = todayValue()) {
  const parsed = parseDate(value)

  if (!parsed) {
    return '--'
  }

  const referenceDate = parseDate(reference) || new Date()
  const diffMinutes = Math.max(0, Math.floor((referenceDate.getTime() - parsed.getTime()) / 60000))

  if (diffMinutes < 1) {
    return 'just now'
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`
  }

  const diffHours = Math.floor(diffMinutes / 60)

  if (diffHours < 24) {
    return `${diffHours}h ago`
  }

  const diffDays = Math.floor(diffHours / 24)

  if (diffDays < 30) {
    return `${diffDays}d ago`
  }

  return parsed.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })
}

function formatCurrency(value, currency) {
  const amount = Number(value)

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0)
}

function escapeCsvValue(value) {
  const text = String(value ?? '')

  if (/[,"\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }

  return text
}

function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function normalizeBook(book) {
  const title = typeof book?.title === 'string' ? book.title.trim() : ''
  const author = typeof book?.author === 'string' ? book.author.trim() : ''
  const summary = typeof book?.summary === 'string' ? book.summary.trim() : ''

  return {
    id: typeof book?.id === 'string' && book.id.trim() ? book.id : createId(),
    title: title || 'Untitled book',
    author: author || 'Unknown author',
    genre: typeof book?.genre === 'string' && book.genre.trim() ? book.genre.trim() : 'Reference',
    shelf: typeof book?.shelf === 'string' && book.shelf.trim() ? book.shelf.trim() : 'A-1',
    isbn: typeof book?.isbn === 'string' ? book.isbn.trim() : '',
    year: Number(book?.year) || new Date().getFullYear(),
    pages: Number(book?.pages) || 0,
    rating: clamp(Number(book?.rating) || 4.5, 0, 5),
    featured: Boolean(book?.featured),
    summary,
    tags: Array.isArray(book?.tags) ? book.tags.map(String).filter(Boolean) : [],
    coverHue: Number.isFinite(Number(book?.coverHue)) ? Number(book.coverHue) : hueFromText(title || author),
    status: BOOK_STATUS_OPTIONS.includes(book?.status) ? book.status : 'available',
    borrowedById: typeof book?.borrowedById === 'string' ? book.borrowedById : null,
    reservedById: typeof book?.reservedById === 'string' ? book.reservedById : null,
    borrowedAt: typeof book?.borrowedAt === 'string' ? book.borrowedAt : null,
    dueDate: typeof book?.dueDate === 'string' ? book.dueDate : null,
    reservedAt: typeof book?.reservedAt === 'string' ? book.reservedAt : null,
    addedAt: typeof book?.addedAt === 'string' ? book.addedAt : todayValue(),
    updatedAt: typeof book?.updatedAt === 'string' ? book.updatedAt : todayValue(),
    timesBorrowed: Number(book?.timesBorrowed) || 0,
  }
}

function normalizeMember(member) {
  const name = typeof member?.name === 'string' ? member.name.trim() : ''

  return {
    id: typeof member?.id === 'string' && member.id.trim() ? member.id : createId(),
    name: name || 'Unnamed member',
    role: MEMBER_ROLES.includes(member?.role) ? member.role : 'Guest',
    email: typeof member?.email === 'string' ? member.email.trim() : '',
    phone: typeof member?.phone === 'string' ? member.phone.trim() : '',
    department: typeof member?.department === 'string' ? member.department.trim() : '',
    notes: typeof member?.notes === 'string' ? member.notes.trim() : '',
    active: member?.active !== false,
    avatarHue: Number.isFinite(Number(member?.avatarHue)) ? Number(member.avatarHue) : hueFromText(name || member?.role),
    joinedAt: typeof member?.joinedAt === 'string' ? member.joinedAt : todayValue(),
    updatedAt: typeof member?.updatedAt === 'string' ? member.updatedAt : todayValue(),
  }
}

function normalizeLoan(loan) {
  return {
    id: typeof loan?.id === 'string' && loan.id.trim() ? loan.id : createId(),
    bookId: typeof loan?.bookId === 'string' ? loan.bookId : '',
    bookTitle: typeof loan?.bookTitle === 'string' ? loan.bookTitle.trim() : 'Unknown book',
    memberId: typeof loan?.memberId === 'string' ? loan.memberId : '',
    memberName: typeof loan?.memberName === 'string' ? loan.memberName.trim() : 'Unknown member',
    issuedAt: typeof loan?.issuedAt === 'string' ? loan.issuedAt : todayValue(),
    dueDate: typeof loan?.dueDate === 'string' ? loan.dueDate : todayValue(),
    returnedAt: typeof loan?.returnedAt === 'string' ? loan.returnedAt : null,
    renewals: Number(loan?.renewals) || 0,
    fineAccrued: Number(loan?.fineAccrued) || 0,
    note: typeof loan?.note === 'string' ? loan.note.trim() : '',
    returnNote: typeof loan?.returnNote === 'string' ? loan.returnNote.trim() : '',
    status: ['active', 'returned', 'lost'].includes(loan?.status) ? loan.status : loan?.returnedAt ? 'returned' : 'active',
    updatedAt: typeof loan?.updatedAt === 'string' ? loan.updatedAt : todayValue(),
  }
}

function normalizeActivity(activity) {
  return {
    id: typeof activity?.id === 'string' && activity.id.trim() ? activity.id : createId(),
    group: ['circulation', 'catalog', 'member', 'system'].includes(activity?.group) ? activity.group : 'system',
    type: typeof activity?.type === 'string' && activity.type.trim() ? activity.type : 'update',
    bookTitle: typeof activity?.bookTitle === 'string' ? activity.bookTitle.trim() : '',
    memberName: typeof activity?.memberName === 'string' ? activity.memberName.trim() : '',
    detail: typeof activity?.detail === 'string' ? activity.detail.trim() : '',
    date: typeof activity?.date === 'string' ? activity.date : todayValue(),
    tone: ['primary', 'accent', 'success', 'warn', 'danger', 'muted'].includes(activity?.tone) ? activity.tone : 'primary',
  }
}

function buildDemoState() {
  const baseDate = todayValue()

  const members = [
    normalizeMember({
      id: createId(),
      name: 'Aarav Mehta',
      role: 'Student',
      email: 'aarav.mehta@example.com',
      phone: '+91 98765 43210',
      department: 'Computer Science',
      notes: 'Prefers digital research collections.',
      avatarHue: 214,
      joinedAt: addDays(baseDate, -180),
      updatedAt: addDays(baseDate, -12),
    }),
    normalizeMember({
      id: createId(),
      name: 'Priya Kapoor',
      role: 'Faculty',
      email: 'priya.kapoor@example.com',
      phone: '+91 98220 44550',
      department: 'Design',
      notes: 'Uses the architecture section frequently.',
      avatarHue: 158,
      joinedAt: addDays(baseDate, -320),
      updatedAt: addDays(baseDate, -8),
    }),
    normalizeMember({
      id: createId(),
      name: 'Neil Fernandes',
      role: 'Researcher',
      email: 'neil.fernandes@example.com',
      phone: '+91 98331 12244',
      department: 'Physics',
      notes: 'Focuses on journals and reference material.',
      avatarHue: 34,
      joinedAt: addDays(baseDate, -120),
      updatedAt: addDays(baseDate, -5),
    }),
    normalizeMember({
      id: createId(),
      name: 'Sofia Khan',
      role: 'Student',
      email: 'sofia.khan@example.com',
      phone: '+91 98111 88990',
      department: 'Economics',
      notes: 'Interested in business and policy books.',
      avatarHue: 296,
      joinedAt: addDays(baseDate, -74),
      updatedAt: addDays(baseDate, -3),
    }),
    normalizeMember({
      id: createId(),
      name: 'Maya Joshi',
      role: 'Guest',
      email: 'maya.joshi@example.com',
      phone: '+91 98770 22110',
      department: 'Alumni',
      notes: 'Occasional visitor from the design studio.',
      avatarHue: 68,
      joinedAt: addDays(baseDate, -25),
      updatedAt: addDays(baseDate, -1),
    }),
  ]

  const memberByName = new Map(members.map((member) => [member.name, member]))

  const books = [
    normalizeBook({
      id: createId(),
      title: 'Clean Code',
      author: 'Robert C. Martin',
      genre: 'Technology',
      shelf: 'T-14',
      isbn: '9780132350884',
      year: 2008,
      pages: 464,
      rating: 4.8,
      featured: true,
      summary: 'A practical guide to writing readable, maintainable code and disciplined engineering habits.',
      tags: ['software', 'engineering', 'best practices'],
      coverHue: 210,
      status: 'borrowed',
      borrowedById: memberByName.get('Aarav Mehta').id,
      borrowedAt: addDays(baseDate, -6),
      dueDate: addDays(baseDate, -1),
      addedAt: addDays(baseDate, -90),
      updatedAt: addDays(baseDate, -1),
      timesBorrowed: 16,
    }),
    normalizeBook({
      id: createId(),
      title: 'Designing Data-Intensive Applications',
      author: 'Martin Kleppmann',
      genre: 'Technology',
      shelf: 'T-21',
      isbn: '9781449373320',
      year: 2017,
      pages: 616,
      rating: 4.9,
      featured: true,
      summary: 'A deep look at the architecture, reliability, and scale of modern data systems.',
      tags: ['databases', 'distributed systems', 'architecture'],
      coverHue: 164,
      status: 'borrowed',
      borrowedById: memberByName.get('Priya Kapoor').id,
      borrowedAt: addDays(baseDate, -3),
      dueDate: addDays(baseDate, 2),
      addedAt: addDays(baseDate, -75),
      updatedAt: addDays(baseDate, -2),
      timesBorrowed: 11,
    }),
    normalizeBook({
      id: createId(),
      title: 'Atomic Habits',
      author: 'James Clear',
      genre: 'Business',
      shelf: 'B-04',
      isbn: '9780735211292',
      year: 2018,
      pages: 320,
      rating: 4.7,
      featured: true,
      summary: 'Tiny changes, repeated consistently, can transform personal and professional outcomes.',
      tags: ['productivity', 'habit building', 'self improvement'],
      coverHue: 42,
      status: 'reserved',
      reservedById: memberByName.get('Sofia Khan').id,
      reservedAt: addDays(baseDate, -1),
      addedAt: addDays(baseDate, -60),
      updatedAt: addDays(baseDate, -1),
      timesBorrowed: 9,
    }),
    normalizeBook({
      id: createId(),
      title: 'Sapiens',
      author: 'Yuval Noah Harari',
      genre: 'History',
      shelf: 'H-09',
      isbn: '9780062316097',
      year: 2014,
      pages: 498,
      rating: 4.6,
      summary: 'A sweeping history of humanity that connects anthropology, culture, and technology.',
      tags: ['civilization', 'anthropology', 'history'],
      coverHue: 18,
      status: 'available',
      addedAt: addDays(baseDate, -50),
      updatedAt: addDays(baseDate, -4),
      timesBorrowed: 7,
    }),
    normalizeBook({
      id: createId(),
      title: 'The Design of Everyday Things',
      author: 'Don Norman',
      genre: 'Design',
      shelf: 'D-17',
      isbn: '9780465050659',
      year: 2013,
      pages: 368,
      rating: 4.5,
      summary: 'A classic exploration of usability, affordance, and the human side of product design.',
      tags: ['ux', 'product design', 'interaction'],
      coverHue: 320,
      status: 'available',
      featured: true,
      addedAt: addDays(baseDate, -33),
      updatedAt: addDays(baseDate, -3),
      timesBorrowed: 6,
    }),
    normalizeBook({
      id: createId(),
      title: 'The Pragmatic Programmer',
      author: 'Andrew Hunt & David Thomas',
      genre: 'Technology',
      shelf: 'T-11',
      isbn: '9780135957059',
      year: 2019,
      pages: 352,
      rating: 4.9,
      summary: 'Tactical advice for building resilient software with curiosity and craftsmanship.',
      tags: ['software', 'craft', 'architecture'],
      coverHue: 252,
      status: 'borrowed',
      borrowedById: memberByName.get('Neil Fernandes').id,
      borrowedAt: addDays(baseDate, -8),
      dueDate: addDays(baseDate, 5),
      addedAt: addDays(baseDate, -65),
      updatedAt: addDays(baseDate, -2),
      timesBorrowed: 14,
    }),
    normalizeBook({
      id: createId(),
      title: 'Circe',
      author: 'Madeline Miller',
      genre: 'Literature',
      shelf: 'L-06',
      isbn: '9780316556347',
      year: 2018,
      pages: 393,
      rating: 4.4,
      summary: 'A lyrical retelling of mythology that blends character study and epic atmosphere.',
      tags: ['mythology', 'novel', 'fiction'],
      coverHue: 10,
      status: 'archived',
      addedAt: addDays(baseDate, -100),
      updatedAt: addDays(baseDate, -20),
      timesBorrowed: 4,
    }),
    normalizeBook({
      id: createId(),
      title: 'A Brief History of Time',
      author: 'Stephen Hawking',
      genre: 'Science',
      shelf: 'S-02',
      isbn: '9780553380163',
      year: 1998,
      pages: 212,
      rating: 4.3,
      summary: 'A concise journey through cosmology, black holes, and the structure of the universe.',
      tags: ['physics', 'cosmology', 'space'],
      coverHue: 200,
      status: 'lost',
      addedAt: addDays(baseDate, -140),
      updatedAt: addDays(baseDate, -12),
      timesBorrowed: 3,
    }),
  ]

  const bookByTitle = new Map(books.map((book) => [book.title, book]))

  const loans = [
    normalizeLoan({
      id: createId(),
      bookId: bookByTitle.get('Clean Code').id,
      bookTitle: 'Clean Code',
      memberId: memberByName.get('Aarav Mehta').id,
      memberName: 'Aarav Mehta',
      issuedAt: addDays(baseDate, -6),
      dueDate: addDays(baseDate, -1),
      renewals: 0,
      fineAccrued: 0,
      note: 'Mid-semester review prep',
      status: 'active',
      updatedAt: addDays(baseDate, -1),
    }),
    normalizeLoan({
      id: createId(),
      bookId: bookByTitle.get('Designing Data-Intensive Applications').id,
      bookTitle: 'Designing Data-Intensive Applications',
      memberId: memberByName.get('Priya Kapoor').id,
      memberName: 'Priya Kapoor',
      issuedAt: addDays(baseDate, -3),
      dueDate: addDays(baseDate, 2),
      renewals: 0,
      fineAccrued: 0,
      note: 'Curriculum reference',
      status: 'active',
      updatedAt: addDays(baseDate, -2),
    }),
    normalizeLoan({
      id: createId(),
      bookId: bookByTitle.get('The Pragmatic Programmer').id,
      bookTitle: 'The Pragmatic Programmer',
      memberId: memberByName.get('Neil Fernandes').id,
      memberName: 'Neil Fernandes',
      issuedAt: addDays(baseDate, -8),
      dueDate: addDays(baseDate, 5),
      renewals: 1,
      fineAccrued: 0,
      note: 'System design deep dive',
      status: 'active',
      updatedAt: addDays(baseDate, -2),
    }),
    normalizeLoan({
      id: createId(),
      bookId: bookByTitle.get('The Design of Everyday Things').id,
      bookTitle: 'The Design of Everyday Things',
      memberId: memberByName.get('Maya Joshi').id,
      memberName: 'Maya Joshi',
      issuedAt: addDays(baseDate, -18),
      dueDate: addDays(baseDate, -8),
      returnedAt: addDays(baseDate, -5),
      renewals: 0,
      fineAccrued: 30,
      returnNote: 'Returned with sketch notes',
      status: 'returned',
      updatedAt: addDays(baseDate, -5),
    }),
  ]

  const activity = [
    normalizeActivity({
      id: createId(),
      group: 'circulation',
      type: 'issue',
      bookTitle: 'Clean Code',
      memberName: 'Aarav Mehta',
      detail: 'Issued for 14 days with a due date reminder.',
      date: addDays(baseDate, -6),
      tone: 'primary',
    }),
    normalizeActivity({
      id: createId(),
      group: 'circulation',
      type: 'issue',
      bookTitle: 'Designing Data-Intensive Applications',
      memberName: 'Priya Kapoor',
      detail: 'Issued from the technology shelf.',
      date: addDays(baseDate, -3),
      tone: 'accent',
    }),
    normalizeActivity({
      id: createId(),
      group: 'circulation',
      type: 'reserve',
      bookTitle: 'Atomic Habits',
      memberName: 'Sofia Khan',
      detail: 'Placed on hold for the next available copy.',
      date: addDays(baseDate, -1),
      tone: 'warn',
    }),
    normalizeActivity({
      id: createId(),
      group: 'member',
      type: 'member-add',
      memberName: 'Maya Joshi',
      detail: 'Guest membership activated for the design studio.',
      date: addDays(baseDate, -25),
      tone: 'success',
    }),
    normalizeActivity({
      id: createId(),
      group: 'catalog',
      type: 'book-edit',
      bookTitle: 'The Design of Everyday Things',
      detail: 'Shelf label and summary updated.',
      date: addDays(baseDate, -3),
      tone: 'muted',
    }),
    normalizeActivity({
      id: createId(),
      group: 'system',
      type: 'seed',
      detail: 'Demo library loaded with books, members, and circulation data.',
      date: addDays(baseDate, -1),
      tone: 'primary',
    }),
  ]

  return {
    books,
    members,
    loans,
    activity,
    prefs: {
      theme: 'light',
      currency: 'INR',
      defaultLoanDays: 14,
      finePerDay: 25,
    },
  }
}

const DEMO_DATA = buildDemoState()

function getInitialBooks() {
  if (typeof window === 'undefined') {
    return DEMO_DATA.books
  }

  const stored = safeParseJSON(window.localStorage.getItem(STORAGE_KEYS.books), null)
  return Array.isArray(stored) && stored.length > 0 ? stored.map(normalizeBook) : DEMO_DATA.books
}

function getInitialMembers() {
  if (typeof window === 'undefined') {
    return DEMO_DATA.members
  }

  const stored = safeParseJSON(window.localStorage.getItem(STORAGE_KEYS.members), null)
  return Array.isArray(stored) && stored.length > 0 ? stored.map(normalizeMember) : DEMO_DATA.members
}

function getInitialLoans() {
  if (typeof window === 'undefined') {
    return DEMO_DATA.loans
  }

  const stored = safeParseJSON(window.localStorage.getItem(STORAGE_KEYS.loans), null)
  return Array.isArray(stored) && stored.length > 0 ? stored.map(normalizeLoan) : DEMO_DATA.loans
}

function getInitialActivity() {
  if (typeof window === 'undefined') {
    return DEMO_DATA.activity
  }

  const stored = safeParseJSON(window.localStorage.getItem(STORAGE_KEYS.activity), null)
  return Array.isArray(stored) && stored.length > 0 ? stored.map(normalizeActivity) : DEMO_DATA.activity
}

function getInitialPrefs() {
  const fallback = DEMO_DATA.prefs

  if (typeof window === 'undefined') {
    return fallback
  }

  const stored = safeParseJSON(window.localStorage.getItem(STORAGE_KEYS.prefs), null)

  if (!stored || typeof stored !== 'object') {
    return fallback
  }

  return {
    theme: stored.theme === 'dark' ? 'dark' : 'light',
    currency: CURRENCY_OPTIONS.includes(stored.currency) ? stored.currency : fallback.currency,
    defaultLoanDays: Number.isFinite(Number(stored.defaultLoanDays)) ? clamp(Number(stored.defaultLoanDays), 1, 90) : fallback.defaultLoanDays,
    finePerDay: Number.isFinite(Number(stored.finePerDay)) ? clamp(Number(stored.finePerDay), 0, 1000) : fallback.finePerDay,
  }
}

function createEmptyBookForm() {
  return {
    title: '',
    author: '',
    genre: 'Technology',
    shelf: 'A-1',
    isbn: '',
    year: String(new Date().getFullYear()),
    pages: '',
    rating: '4.5',
    featured: false,
    summary: '',
    tags: '',
    coverHue: '214',
  }
}

function createEmptyMemberForm() {
  return {
    name: '',
    role: 'Student',
    email: '',
    phone: '',
    department: '',
    notes: '',
    active: true,
  }
}

function createEmptyCirculationForm(defaultLoanDays = 14) {
  return {
    mode: 'issue',
    bookId: '',
    memberId: '',
    loanId: '',
    dueDays: String(defaultLoanDays),
    extraDays: '7',
    note: '',
  }
}

function resolveBookStatus(book, activeLoanMap) {
  if (book.status === 'lost' || book.status === 'archived') {
    return book.status
  }

  if (activeLoanMap.has(book.id)) {
    return 'borrowed'
  }

  if (book.reservedById) {
    return 'reserved'
  }

  return 'available'
}

function getStatusTone(status) {
  switch (status) {
    case 'available':
      return 'success'
    case 'borrowed':
      return 'warn'
    case 'reserved':
      return 'accent'
    case 'lost':
      return 'danger'
    default:
      return 'muted'
  }
}

function getStatusLabel(status) {
  switch (status) {
    case 'available':
      return 'Available'
    case 'borrowed':
      return 'Borrowed'
    case 'reserved':
      return 'Reserved'
    case 'lost':
      return 'Lost'
    case 'archived':
      return 'Archived'
    default:
      return 'Unknown'
  }
}

function computeLoanFine(loan, finePerDay, referenceDate = todayValue()) {
  if (loan.returnedAt || !loan.dueDate) {
    return Number(loan.fineAccrued) || 0
  }

  const overdueDays = Math.max(0, daysBetween(loan.dueDate, referenceDate))
  return overdueDays * Number(finePerDay || 0)
}

function computeOutstandingFine(loans, finePerDay, referenceDate = todayValue()) {
  return loans.reduce((sum, loan) => sum + computeLoanFine(loan, finePerDay, referenceDate), 0)
}

function getLoanStatusMeta(loan, finePerDay, referenceDate = todayValue()) {
  if (loan.returnedAt) {
    return { label: 'Returned', tone: 'success', overdueDays: 0, fine: Number(loan.fineAccrued) || 0 }
  }

  const overdueDays = Math.max(0, daysBetween(loan.dueDate, referenceDate))

  if (overdueDays > 0) {
    return { label: `Overdue by ${overdueDays}d`, tone: 'danger', overdueDays, fine: overdueDays * Number(finePerDay || 0) }
  }

  const daysLeft = Math.max(0, daysBetween(referenceDate, loan.dueDate))

  if (daysLeft === 0) {
    return { label: 'Due today', tone: 'warn', overdueDays: 0, fine: 0 }
  }

  if (daysLeft <= 3) {
    return { label: `Due in ${daysLeft}d`, tone: 'warn', overdueDays: 0, fine: 0 }
  }

  return { label: `${daysLeft}d left`, tone: 'success', overdueDays: 0, fine: 0 }
}

function compareBooks(left, right, sortBy, activeLoanMap, referenceDate) {
  switch (sortBy) {
    case 'title':
      return left.title.localeCompare(right.title)
    case 'author':
      return left.author.localeCompare(right.author)
    case 'genre':
      return left.genre.localeCompare(right.genre) || left.title.localeCompare(right.title)
    case 'rating':
      return right.rating - left.rating || left.title.localeCompare(right.title)
    case 'due-soon': {
      const leftLoan = activeLoanMap.get(left.id)
      const rightLoan = activeLoanMap.get(right.id)
      const leftDue = leftLoan ? daysBetween(referenceDate, leftLoan.dueDate) : Number.POSITIVE_INFINITY
      const rightDue = rightLoan ? daysBetween(referenceDate, rightLoan.dueDate) : Number.POSITIVE_INFINITY
      return leftDue - rightDue || right.updatedAt.localeCompare(left.updatedAt)
    }
    case 'status': {
      const statusOrder = { available: 0, reserved: 1, borrowed: 2, lost: 3, archived: 4 }
      const leftStatus = statusOrder[resolveBookStatus(left, activeLoanMap)] ?? 99
      const rightStatus = statusOrder[resolveBookStatus(right, activeLoanMap)] ?? 99
      return leftStatus - rightStatus || left.title.localeCompare(right.title)
    }
    default:
      return right.updatedAt.localeCompare(left.updatedAt)
  }
}

function compareMembers(left, right, sortBy, statsMap) {
  switch (sortBy) {
    case 'name':
      return left.name.localeCompare(right.name)
    case 'role':
      return left.role.localeCompare(right.role) || left.name.localeCompare(right.name)
    case 'loans':
      return (statsMap.get(right.id)?.activeLoans || 0) - (statsMap.get(left.id)?.activeLoans || 0) || left.name.localeCompare(right.name)
    case 'fines':
      return (statsMap.get(right.id)?.fineDue || 0) - (statsMap.get(left.id)?.fineDue || 0) || left.name.localeCompare(right.name)
    default:
      return right.updatedAt.localeCompare(left.updatedAt)
  }
}

function StatCard({ label, value, detail, tone = 'muted' }) {
  return (
    <article className={`stat-card tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <p>{detail}</p> : null}
    </article>
  )
}

function PanelBlock({ kicker, title, description, action, children }) {
  return (
    <section className="panel-block">
      <div className="panel-block-head">
        <div>
          <span className="section-kicker">{kicker}</span>
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
        {action ? <div className="panel-block-action">{action}</div> : null}
      </div>
      {children}
    </section>
  )
}

function Chip({ tone = 'muted', children }) {
  return <span className={`chip chip-${tone}`}>{children}</span>
}

function BookCard({
  book,
  status,
  activeLoan,
  borrower,
  reservedMember,
  currency,
  onEdit,
  onDelete,
  onArchive,
  onRestore,
  onMarkLost,
  onPrepareCirculation,
}) {
  const dueMeta = activeLoan ? getLoanStatusMeta(activeLoan, 0) : null

  return (
    <article className="book-card" style={{ '--cover-hue': book.coverHue }}>
      <div className="book-cover">
        <div className="book-cover-inner">
          <span>{book.genre}</span>
          <strong>{book.title.slice(0, 2).toUpperCase()}</strong>
        </div>
      </div>

      <div className="book-card-body">
        <div className="book-card-topline">
          <div>
            <h4>{book.title}</h4>
            <p>{book.author}</p>
          </div>
          <Chip tone={getStatusTone(status)}>{getStatusLabel(status)}</Chip>
        </div>

        <div className="chip-row">
          {book.featured ? <Chip tone="accent">Featured</Chip> : null}
          <Chip tone="muted">Shelf {book.shelf}</Chip>
          <Chip tone="muted">{book.year}</Chip>
          <Chip tone="muted">{book.rating.toFixed(1)}★</Chip>
          {book.timesBorrowed > 0 ? <Chip tone="success">{book.timesBorrowed} loans</Chip> : null}
        </div>

        {book.summary ? <p className="book-summary">{book.summary}</p> : null}

        {book.tags.length > 0 ? (
          <div className="chip-row tag-row">
            {book.tags.slice(0, 4).map((tag) => (
              <Chip key={tag}>{tag}</Chip>
            ))}
          </div>
        ) : null}

        <div className="book-meta-grid">
          <div>
            <span>ISBN</span>
            <strong>{book.isbn || '—'}</strong>
          </div>
          <div>
            <span>Pages</span>
            <strong>{book.pages || '—'}</strong>
          </div>
          <div>
            <span>Added</span>
            <strong>{formatDate(book.addedAt)}</strong>
          </div>
          <div>
            <span>Updated</span>
            <strong>{formatTimeAgo(book.updatedAt)}</strong>
          </div>
        </div>

        {activeLoan ? (
          <div className="loan-pill">
            <strong>{borrower?.name || activeLoan.memberName}</strong>
            <span>{dueMeta?.label || formatDate(activeLoan.dueDate)}</span>
          </div>
        ) : null}

        {reservedMember && !activeLoan ? (
          <div className="loan-pill reserve-pill">
            <strong>Reserved by {reservedMember.name}</strong>
            <span>Hold placed {formatTimeAgo(book.reservedAt)}</span>
          </div>
        ) : null}

        <div className="book-actions">
          <button type="button" className="button button-secondary" onClick={onEdit}>
            Edit
          </button>
          {status !== 'archived' && status !== 'lost' ? (
            <>
              <button type="button" className="button button-primary" onClick={onPrepareCirculation.issue}>
                Issue
              </button>
              <button type="button" className="button button-secondary" onClick={onPrepareCirculation.reserve}>
                Reserve
              </button>
              <button type="button" className="button button-secondary" onClick={onPrepareCirculation.renew}>
                Renew
              </button>
              <button type="button" className="button button-secondary" onClick={onPrepareCirculation.return}>
                Return
              </button>
              <button type="button" className="button button-secondary" onClick={onMarkLost}>
                Mark lost
              </button>
              <button type="button" className="button button-secondary" onClick={onArchive}>
                Archive
              </button>
            </>
          ) : (
            <button type="button" className="button button-secondary" onClick={onRestore}>
              Restore
            </button>
          )}
          <button type="button" className="button button-danger" onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>
    </article>
  )
}

function MemberCard({ member, stats, currency, onEdit, onToggleActive, onDelete, onPrepareIssue }) {
  return (
    <article className={`member-card ${member.active ? 'active' : 'inactive'}`} style={{ '--avatar-hue': member.avatarHue }}>
      <div className="member-card-topline">
        <div className="member-avatar">{member.name.slice(0, 1).toUpperCase()}</div>
        <div className="member-headline">
          <h4>{member.name}</h4>
          <p>
            {member.role} {member.department ? `· ${member.department}` : ''}
          </p>
        </div>
        <Chip tone={member.active ? 'success' : 'danger'}>{member.active ? 'Active' : 'Inactive'}</Chip>
      </div>

      <div className="member-meta-grid">
        <div>
          <span>Email</span>
          <strong>{member.email || '—'}</strong>
        </div>
        <div>
          <span>Phone</span>
          <strong>{member.phone || '—'}</strong>
        </div>
        <div>
          <span>Active loans</span>
          <strong>{stats.activeLoans}</strong>
        </div>
        <div>
          <span>Fine due</span>
          <strong>{formatCurrency(stats.fineDue, currency)}</strong>
        </div>
      </div>

      {stats.borrowedTitles.length > 0 ? (
        <div className="chip-row tag-row">
          {stats.borrowedTitles.slice(0, 3).map((title) => (
            <Chip key={title} tone="accent">
              {title}
            </Chip>
          ))}
        </div>
      ) : null}

      {member.notes ? <p className="member-notes">{member.notes}</p> : null}

      <div className="book-actions member-actions">
        <button type="button" className="button button-primary" onClick={onPrepareIssue}>
          Issue to member
        </button>
        <button type="button" className="button button-secondary" onClick={onEdit}>
          Edit
        </button>
        <button type="button" className="button button-secondary" onClick={onToggleActive}>
          {member.active ? 'Deactivate' : 'Activate'}
        </button>
        <button type="button" className="button button-danger" onClick={onDelete}>
          Delete
        </button>
      </div>
    </article>
  )
}

function ActivityRow({ activity }) {
  const tone = activity.tone || 'muted'
  const title = activity.bookTitle || activity.memberName || activity.type

  return (
    <article className={`activity-row tone-${tone}`}>
      <div className="activity-badge">{activity.type.slice(0, 1).toUpperCase()}</div>
      <div className="activity-copy">
        <div className="activity-topline">
          <strong>{title}</strong>
          <span>{formatTimeAgo(activity.date)}</span>
        </div>
        <p>{activity.detail}</p>
        <div className="chip-row">
          <Chip tone={tone}>{activity.group}</Chip>
          {activity.memberName ? <Chip tone="muted">{activity.memberName}</Chip> : null}
        </div>
      </div>
    </article>
  )
}

function App() {
  const [books, setBooks] = useState(() => getInitialBooks())
  const [members, setMembers] = useState(() => getInitialMembers())
  const [loans, setLoans] = useState(() => getInitialLoans())
  const [activity, setActivity] = useState(() => getInitialActivity())
  const [prefs, setPrefs] = useState(() => getInitialPrefs())

  const [bookForm, setBookForm] = useState(() => createEmptyBookForm())
  const [memberForm, setMemberForm] = useState(() => createEmptyMemberForm())
  const [circulationForm, setCirculationForm] = useState(() => createEmptyCirculationForm(getInitialPrefs().defaultLoanDays))

  const [editingBookId, setEditingBookId] = useState(null)
  const [editingMemberId, setEditingMemberId] = useState(null)

  const [bookSearch, setBookSearch] = useState('')
  const [bookStatusFilter, setBookStatusFilter] = useState('all')
  const [genreFilter, setGenreFilter] = useState('all')
  const [bookSort, setBookSort] = useState('recent')

  const [memberSearch, setMemberSearch] = useState('')
  const [memberRoleFilter, setMemberRoleFilter] = useState('all')
  const [memberSort, setMemberSort] = useState('recent')

  const [activityFilter, setActivityFilter] = useState('all')
  const [statusMessage, setStatusMessage] = useState('')

  const importInputRef = useRef(null)
  const statusTimerRef = useRef(null)

  const referenceDate = todayValue()

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(STORAGE_KEYS.books, JSON.stringify(books))
  }, [books])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(STORAGE_KEYS.members, JSON.stringify(members))
  }, [members])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(STORAGE_KEYS.loans, JSON.stringify(loans))
  }, [loans])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(STORAGE_KEYS.activity, JSON.stringify(activity))
  }, [activity])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(STORAGE_KEYS.prefs, JSON.stringify(prefs))
  }, [prefs])

  useEffect(() => {
    return () => {
      if (statusTimerRef.current) {
        clearTimeout(statusTimerRef.current)
      }
    }
  }, [])

  const activeLoanMap = useMemo(() => {
    const map = new Map()
    loans.forEach((loan) => {
      if (!loan.returnedAt && loan.status === 'active') {
        map.set(loan.bookId, loan)
      }
    })
    return map
  }, [loans])

  const activeLoans = useMemo(() => loans.filter((loan) => !loan.returnedAt && loan.status === 'active'), [loans])

  const activeLoansByMember = useMemo(() => {
    const map = new Map()

    activeLoans.forEach((loan) => {
      const bucket = map.get(loan.memberId) || []
      bucket.push(loan)
      map.set(loan.memberId, bucket)
    })

    return map
  }, [activeLoans])

  const loanStatsByMember = useMemo(() => {
    const map = new Map()

    members.forEach((member) => {
      const activeCount = activeLoansByMember.get(member.id)?.length || 0
      const loanHistory = loans.filter((loan) => loan.memberId === member.id)
      const fineDue = loanHistory.reduce((sum, loan) => sum + computeLoanFine(loan, prefs.finePerDay, referenceDate), 0)
      const borrowedTitles = activeLoansByMember.get(member.id)?.map((loan) => loan.bookTitle) || []

      map.set(member.id, {
        activeLoans: activeCount,
        totalLoans: loanHistory.length,
        fineDue,
        borrowedTitles,
      })
    })

    return map
  }, [activeLoansByMember, loans, members, prefs.finePerDay, referenceDate])

  const overdueLoans = useMemo(
    () => activeLoans.filter((loan) => daysBetween(referenceDate, loan.dueDate) < 0),
    [activeLoans, referenceDate],
  )

  const dueSoonLoans = useMemo(
    () => activeLoans.filter((loan) => {
      const daysLeft = daysBetween(referenceDate, loan.dueDate)
      return daysLeft >= 0 && daysLeft <= 3
    }),
    [activeLoans, referenceDate],
  )

  const outstandingFine = useMemo(
    () => computeOutstandingFine(loans, prefs.finePerDay, referenceDate),
    [loans, prefs.finePerDay, referenceDate],
  )

  const bookStats = useMemo(() => {
    const statusCounts = books.reduce(
      (accumulator, book) => {
        const status = resolveBookStatus(book, activeLoanMap)
        accumulator[status] = (accumulator[status] || 0) + 1
        return accumulator
      },
      { available: 0, borrowed: 0, reserved: 0, lost: 0, archived: 0 },
    )

    const total = books.length
    const activeCatalog = Math.max(total - statusCounts.archived, 1)
    const healthScore = Math.round(((statusCounts.available + statusCounts.reserved) / activeCatalog) * 100)
    const featured = books.filter((book) => book.featured).length

    return {
      total,
      featured,
      available: statusCounts.available,
      borrowed: statusCounts.borrowed,
      reserved: statusCounts.reserved,
      lost: statusCounts.lost,
      archived: statusCounts.archived,
      activeMembers: members.filter((member) => member.active).length,
      overdue: overdueLoans.length,
      dueSoon: dueSoonLoans.length,
      healthScore,
    }
  }, [books, members, overdueLoans.length, dueSoonLoans.length, activeLoanMap])

  const statusBreakdown = useMemo(() => {
    const counts = books.reduce(
      (accumulator, book) => {
        const status = resolveBookStatus(book, activeLoanMap)
        accumulator[status] = (accumulator[status] || 0) + 1
        return accumulator
      },
      { available: 0, borrowed: 0, reserved: 0, lost: 0, archived: 0 },
    )

    return Object.entries(counts)
      .map(([status, count]) => ({ status, count }))
      .filter((item) => item.count > 0)
  }, [books, activeLoanMap])

  const genreBreakdown = useMemo(() => {
    const counts = books.reduce((accumulator, book) => {
      if (resolveBookStatus(book, activeLoanMap) === 'archived') {
        return accumulator
      }

      accumulator[book.genre] = (accumulator[book.genre] || 0) + 1
      return accumulator
    }, {})

    return Object.entries(counts)
      .map(([genre, count]) => ({ genre, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 6)
  }, [books, activeLoanMap])

  const mostBorrowedBook = useMemo(() => {
    const sorted = books.slice().sort((left, right) => right.timesBorrowed - left.timesBorrowed)
    return sorted[0] || null
  }, [books])

  const activeTitles = useMemo(() => activeLoans.map((loan) => loan.bookTitle), [activeLoans])

  const filteredBooks = useMemo(() => {
    const query = bookSearch.trim().toLowerCase()

    return books
      .filter((book) => {
        const status = resolveBookStatus(book, activeLoanMap)
        const matchesSearch =
          !query ||
          [book.title, book.author, book.genre, book.shelf, book.isbn, book.summary, book.tags.join(' ')]
            .join(' ')
            .toLowerCase()
            .includes(query)
        const matchesStatus = bookStatusFilter === 'all' || status === bookStatusFilter
        const matchesGenre = genreFilter === 'all' || book.genre === genreFilter

        return matchesSearch && matchesStatus && matchesGenre
      })
      .slice()
      .sort((left, right) => compareBooks(left, right, bookSort, activeLoanMap, referenceDate))
  }, [activeLoanMap, bookSearch, bookSort, bookStatusFilter, books, genreFilter, referenceDate])

  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase()

    return members
      .filter((member) => {
        const stats = loanStatsByMember.get(member.id) || { activeLoans: 0, fineDue: 0 }
        const matchesSearch =
          !query ||
          [member.name, member.role, member.email, member.phone, member.department, member.notes]
            .join(' ')
            .toLowerCase()
            .includes(query)
        const matchesRole = memberRoleFilter === 'all' || member.role === memberRoleFilter

        return matchesSearch && matchesRole && (stats.activeLoans >= 0 || stats.fineDue >= 0)
      })
      .slice()
      .sort((left, right) => compareMembers(left, right, memberSort, loanStatsByMember))
  }, [loanStatsByMember, memberRoleFilter, memberSearch, memberSort, members])

  const filteredActivity = useMemo(() => {
    return activity
      .filter((entry) => activityFilter === 'all' || entry.group === activityFilter)
      .slice()
      .sort((left, right) => right.date.localeCompare(left.date))
  }, [activity, activityFilter])

  const bookOptions = useMemo(
    () => books.filter((book) => resolveBookStatus(book, activeLoanMap) !== 'archived' && resolveBookStatus(book, activeLoanMap) !== 'lost'),
    [activeLoanMap, books],
  )

  const activeMemberOptions = useMemo(() => members.filter((member) => member.active), [members])

  const memberLookup = useMemo(() => new Map(members.map((member) => [member.id, member])), [members])

  const currentLoanOptions = useMemo(() => activeLoans.slice().sort((left, right) => left.dueDate.localeCompare(right.dueDate)), [activeLoans])

  function flash(message) {
    setStatusMessage(message)

    if (statusTimerRef.current) {
      clearTimeout(statusTimerRef.current)
    }

    statusTimerRef.current = window.setTimeout(() => {
      setStatusMessage('')
    }, 3000)
  }

  function addActivity(entry) {
    setActivity((currentActivity) => [normalizeActivity(entry), ...currentActivity].slice(0, 40))
  }

  function resetBookForm() {
    setBookForm(createEmptyBookForm())
    setEditingBookId(null)
  }

  function resetMemberForm() {
    setMemberForm(createEmptyMemberForm())
    setEditingMemberId(null)
  }

  function resetCirculationForm(mode = 'issue') {
    setCirculationForm({ ...createEmptyCirculationForm(prefs.defaultLoanDays), mode })
  }

  function selectFallbackMemberId(preferredMemberId = '') {
    if (preferredMemberId) {
      return preferredMemberId
    }

    return activeMemberOptions[0]?.id || members[0]?.id || ''
  }

  function prepareCirculation(mode, payload = {}) {
    setCirculationForm((currentForm) => ({
      ...createEmptyCirculationForm(prefs.defaultLoanDays),
      ...currentForm,
      ...payload,
      mode,
    }))
    flash(`Ready to ${mode} a book.`)
  }

  function handleThemeToggle() {
    setPrefs((currentPrefs) => ({
      ...currentPrefs,
      theme: currentPrefs.theme === 'dark' ? 'light' : 'dark',
    }))
  }

  function handleSettingChange(field, value) {
    setPrefs((currentPrefs) => ({
      ...currentPrefs,
      [field]: value,
    }))
  }

  function handleSubmitBook(event) {
    event.preventDefault()

    const title = bookForm.title.trim()
    const author = bookForm.author.trim()

    if (!title || !author) {
      flash('Add a title and author before saving a book.')
      return
    }

    const existingBook = books.find((book) => book.id === editingBookId)
    const nextBook = normalizeBook({
      ...(existingBook || {}),
      id: editingBookId || createId(),
      title,
      author,
      genre: bookForm.genre.trim() || 'Reference',
      shelf: bookForm.shelf.trim() || 'A-1',
      isbn: bookForm.isbn.trim(),
      year: Number(bookForm.year) || new Date().getFullYear(),
      pages: Number(bookForm.pages) || 0,
      rating: clamp(Number(bookForm.rating) || 4.5, 0, 5),
      featured: Boolean(bookForm.featured),
      summary: bookForm.summary.trim(),
      tags: bookForm.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      coverHue: Number.isFinite(Number(bookForm.coverHue)) ? clamp(Number(bookForm.coverHue), 0, 360) : hueFromText(title),
      updatedAt: todayValue(),
      addedAt: existingBook?.addedAt || todayValue(),
      timesBorrowed: existingBook?.timesBorrowed || 0,
      borrowedById: existingBook?.borrowedById || null,
      reservedById: existingBook?.reservedById || null,
      borrowedAt: existingBook?.borrowedAt || null,
      dueDate: existingBook?.dueDate || null,
      reservedAt: existingBook?.reservedAt || null,
      status: existingBook?.status || 'available',
    })

    setBooks((currentBooks) => {
      if (editingBookId) {
        return currentBooks.map((book) => (book.id === editingBookId ? nextBook : book))
      }

      return [nextBook, ...currentBooks]
    })

    addActivity({
      group: 'catalog',
      type: editingBookId ? 'book-edit' : 'book-add',
      bookTitle: nextBook.title,
      detail: editingBookId ? 'Book metadata updated.' : 'New book added to the catalog.',
      date: todayValue(),
      tone: editingBookId ? 'accent' : 'success',
    })

    flash(editingBookId ? 'Book updated.' : 'Book added to catalog.')
    resetBookForm()
  }

  function handleEditBook(book) {
    setEditingBookId(book.id)
    setBookForm({
      title: book.title,
      author: book.author,
      genre: book.genre,
      shelf: book.shelf,
      isbn: book.isbn,
      year: String(book.year),
      pages: String(book.pages || ''),
      rating: String(book.rating),
      featured: Boolean(book.featured),
      summary: book.summary || '',
      tags: book.tags.join(', '),
      coverHue: String(book.coverHue),
    })
    flash(`Editing ${book.title}.`)
  }

  function handleDeleteBook(bookId) {
    const targetBook = books.find((book) => book.id === bookId)
    if (!targetBook) {
      return
    }

    if (activeLoanMap.has(bookId)) {
      flash('Return or close the active loan before deleting this book.')
      return
    }

    if (typeof window !== 'undefined' && !window.confirm(`Delete ${targetBook.title}?`)) {
      return
    }

    setBooks((currentBooks) => currentBooks.filter((book) => book.id !== bookId))
    addActivity({
      group: 'catalog',
      type: 'book-delete',
      bookTitle: targetBook.title,
      detail: 'Book removed from the catalog.',
      date: todayValue(),
      tone: 'danger',
    })
    flash('Book deleted.')

    if (editingBookId === bookId) {
      resetBookForm()
    }
  }

  function handleArchiveBook(bookId) {
    if (activeLoanMap.has(bookId)) {
      flash('Return the active loan before archiving this book.')
      return
    }

    setBooks((currentBooks) =>
      currentBooks.map((book) =>
        book.id === bookId
          ? {
              ...book,
              status: 'archived',
              updatedAt: todayValue(),
            }
          : book,
      ),
    )

    const targetBook = books.find((book) => book.id === bookId)
    addActivity({
      group: 'catalog',
      type: 'archive',
      bookTitle: targetBook?.title || 'Book',
      detail: 'Book archived from active circulation.',
      date: todayValue(),
      tone: 'muted',
    })
    flash('Book archived.')
  }

  function handleRestoreBook(bookId) {
    setBooks((currentBooks) =>
      currentBooks.map((book) =>
        book.id === bookId
          ? {
              ...book,
              status: book.reservedById ? 'reserved' : 'available',
              updatedAt: todayValue(),
            }
          : book,
      ),
    )

    const targetBook = books.find((book) => book.id === bookId)
    addActivity({
      group: 'catalog',
      type: 'restore',
      bookTitle: targetBook?.title || 'Book',
      detail: 'Book restored to the catalog.',
      date: todayValue(),
      tone: 'success',
    })
    flash('Book restored.')
  }

  function handleMarkLost(bookId) {
    const activeLoan = activeLoanMap.get(bookId) || null
    const targetBook = books.find((book) => book.id === bookId)

    if (!targetBook) {
      return
    }

    if (activeLoan) {
      setLoans((currentLoans) =>
        currentLoans.map((loan) =>
          loan.id === activeLoan.id
            ? {
                ...loan,
                status: 'lost',
                returnedAt: todayValue(),
                fineAccrued: computeLoanFine(loan, prefs.finePerDay, todayValue()),
                returnNote: 'Marked as lost',
                updatedAt: todayValue(),
              }
            : loan,
        ),
      )
    }

    setBooks((currentBooks) =>
      currentBooks.map((book) =>
        book.id === bookId
          ? {
              ...book,
              status: 'lost',
              borrowedById: null,
              borrowedAt: null,
              dueDate: null,
              updatedAt: todayValue(),
            }
          : book,
      ),
    )

    addActivity({
      group: 'catalog',
      type: 'lost',
      bookTitle: targetBook.title,
      detail: 'Book marked as lost and removed from active lending.',
      date: todayValue(),
      tone: 'danger',
    })
    flash('Book marked as lost.')
  }

  function handleSubmitMember(event) {
    event.preventDefault()

    const name = memberForm.name.trim()

    if (!name) {
      flash('Add a member name before saving.')
      return
    }

    const existingMember = members.find((member) => member.id === editingMemberId)
    const nextMember = normalizeMember({
      ...(existingMember || {}),
      id: editingMemberId || createId(),
      name,
      role: memberForm.role,
      email: memberForm.email.trim(),
      phone: memberForm.phone.trim(),
      department: memberForm.department.trim(),
      notes: memberForm.notes.trim(),
      active: Boolean(memberForm.active),
      avatarHue: existingMember?.avatarHue || hueFromText(name),
      joinedAt: existingMember?.joinedAt || todayValue(),
      updatedAt: todayValue(),
    })

    setMembers((currentMembers) => {
      if (editingMemberId) {
        return currentMembers.map((member) => (member.id === editingMemberId ? nextMember : member))
      }

      return [nextMember, ...currentMembers]
    })

    addActivity({
      group: 'member',
      type: editingMemberId ? 'member-edit' : 'member-add',
      memberName: nextMember.name,
      detail: editingMemberId ? 'Member details updated.' : 'New member enrolled.',
      date: todayValue(),
      tone: editingMemberId ? 'accent' : 'success',
    })

    flash(editingMemberId ? 'Member updated.' : 'Member added.')
    resetMemberForm()
  }

  function handleEditMember(member) {
    setEditingMemberId(member.id)
    setMemberForm({
      name: member.name,
      role: member.role,
      email: member.email,
      phone: member.phone,
      department: member.department,
      notes: member.notes,
      active: Boolean(member.active),
    })
    flash(`Editing ${member.name}.`)
  }

  function handleDeleteMember(memberId) {
    const activeLoan = activeLoans.find((loan) => loan.memberId === memberId)
    const targetMember = members.find((member) => member.id === memberId)

    if (!targetMember) {
      return
    }

    if (activeLoan) {
      flash('Return active loans before deleting this member.')
      return
    }

    if (typeof window !== 'undefined' && !window.confirm(`Delete ${targetMember.name}?`)) {
      return
    }

    setMembers((currentMembers) => currentMembers.filter((member) => member.id !== memberId))
    setBooks((currentBooks) =>
      currentBooks.map((book) =>
        book.reservedById === memberId
          ? {
              ...book,
              reservedById: null,
              reservedAt: null,
              status: book.status === 'reserved' ? 'available' : book.status,
            }
          : book,
      ),
    )

    addActivity({
      group: 'member',
      type: 'member-delete',
      memberName: targetMember.name,
      detail: 'Member removed from the library roster.',
      date: todayValue(),
      tone: 'danger',
    })
    flash('Member deleted.')

    if (editingMemberId === memberId) {
      resetMemberForm()
    }
  }

  function handleToggleMember(memberId) {
    const targetMember = members.find((member) => member.id === memberId)

    if (!targetMember) {
      return
    }

    setMembers((currentMembers) =>
      currentMembers.map((member) =>
        member.id === memberId
          ? {
              ...member,
              active: !member.active,
              updatedAt: todayValue(),
            }
          : member,
      ),
    )

    addActivity({
      group: 'member',
      type: 'member-status',
      memberName: targetMember.name,
      detail: targetMember.active ? 'Member deactivated.' : 'Member activated.',
      date: todayValue(),
      tone: targetMember.active ? 'warn' : 'success',
    })
    flash(targetMember.active ? 'Member deactivated.' : 'Member activated.')
  }

  function issueBook(bookId, memberId, dueDays, note = '') {
    const targetBook = books.find((book) => book.id === bookId)
    const targetMember = members.find((member) => member.id === memberId)

    if (!targetBook || !targetMember) {
      flash('Pick a valid book and member.')
      return
    }

    if (!targetMember.active) {
      flash('Activate the member before issuing a book.')
      return
    }

    const status = resolveBookStatus(targetBook, activeLoanMap)

    if (status === 'archived' || status === 'lost') {
      flash('Archived or lost books cannot be issued.')
      return
    }

    if (activeLoanMap.has(bookId)) {
      flash('This book already has an active loan.')
      return
    }

    if (targetBook.reservedById && targetBook.reservedById !== memberId) {
      flash('This book is reserved by another member.')
      return
    }

    const issuedAt = referenceDate
    const loan = normalizeLoan({
      id: createId(),
      bookId: targetBook.id,
      bookTitle: targetBook.title,
      memberId: targetMember.id,
      memberName: targetMember.name,
      issuedAt,
      dueDate: addDays(issuedAt, dueDays || prefs.defaultLoanDays),
      note: note.trim(),
      renewals: 0,
      fineAccrued: 0,
      status: 'active',
      updatedAt: issuedAt,
    })

    setLoans((currentLoans) => [loan, ...currentLoans])
    setBooks((currentBooks) =>
      currentBooks.map((book) =>
        book.id === bookId
          ? {
              ...book,
              status: 'borrowed',
              borrowedById: memberId,
              borrowedAt: issuedAt,
              dueDate: loan.dueDate,
              reservedById: book.reservedById === memberId ? null : book.reservedById,
              reservedAt: book.reservedById === memberId ? null : book.reservedAt,
              timesBorrowed: (book.timesBorrowed || 0) + 1,
              updatedAt: issuedAt,
            }
          : book,
      ),
    )

    addActivity({
      group: 'circulation',
      type: 'issue',
      bookTitle: targetBook.title,
      memberName: targetMember.name,
      detail: `Issued until ${formatDate(loan.dueDate)}${note.trim() ? ` · ${note.trim()}` : ''}`,
      date: issuedAt,
      tone: 'primary',
    })
    flash(`Issued ${targetBook.title} to ${targetMember.name}.`)
    resetCirculationForm('issue')
  }

  function returnLoan(loanId, note = '') {
    const targetLoan = loans.find((loan) => loan.id === loanId)

    if (!targetLoan || targetLoan.returnedAt) {
      flash('Choose an active loan to return.')
      return
    }

    const targetBook = books.find((book) => book.id === targetLoan.bookId)
    const targetMember = members.find((member) => member.id === targetLoan.memberId)
    const fine = computeLoanFine(targetLoan, prefs.finePerDay, referenceDate)

    setLoans((currentLoans) =>
      currentLoans.map((loan) =>
        loan.id === loanId
          ? {
              ...loan,
              returnedAt: referenceDate,
              status: fine > 0 ? 'returned' : 'returned',
              fineAccrued: fine,
              returnNote: note.trim(),
              updatedAt: referenceDate,
            }
          : loan,
      ),
    )

    setBooks((currentBooks) =>
      currentBooks.map((book) =>
        book.id === targetLoan.bookId
          ? {
              ...book,
              status: book.reservedById ? 'reserved' : 'available',
              borrowedById: null,
              borrowedAt: null,
              dueDate: null,
              updatedAt: referenceDate,
            }
          : book,
      ),
    )

    addActivity({
      group: 'circulation',
      type: 'return',
      bookTitle: targetBook?.title || targetLoan.bookTitle,
      memberName: targetMember?.name || targetLoan.memberName,
      detail: `${fine > 0 ? `Late fee ${formatCurrency(fine, prefs.currency)}.` : 'Returned on time.'}${note.trim() ? ` ${note.trim()}` : ''}`,
      date: referenceDate,
      tone: fine > 0 ? 'warn' : 'success',
    })
    flash(`${targetLoan.bookTitle} returned.`)
    resetCirculationForm('return')
  }

  function reserveBook(bookId, memberId, note = '') {
    const targetBook = books.find((book) => book.id === bookId)
    const targetMember = members.find((member) => member.id === memberId)

    if (!targetBook || !targetMember) {
      flash('Pick a valid book and member.')
      return
    }

    if (!targetMember.active) {
      flash('Activate the member before reserving a book.')
      return
    }

    const status = resolveBookStatus(targetBook, activeLoanMap)

    if (status === 'archived' || status === 'lost') {
      flash('Archived or lost books cannot be reserved.')
      return
    }

    if (targetBook.reservedById === memberId) {
      flash('This book is already reserved by that member.')
      return
    }

    setBooks((currentBooks) =>
      currentBooks.map((book) =>
        book.id === bookId
          ? {
              ...book,
              reservedById: memberId,
              reservedAt: referenceDate,
              status: book.borrowedById ? 'borrowed' : 'reserved',
              updatedAt: referenceDate,
            }
          : book,
      ),
    )

    addActivity({
      group: 'circulation',
      type: 'reserve',
      bookTitle: targetBook.title,
      memberName: targetMember.name,
      detail: `Reservation placed${note.trim() ? ` · ${note.trim()}` : ''}.`,
      date: referenceDate,
      tone: 'warn',
    })
    flash(`${targetBook.title} reserved for ${targetMember.name}.`)
    resetCirculationForm('reserve')
  }

  function renewLoan(loanId, extraDays, note = '') {
    const targetLoan = loans.find((loan) => loan.id === loanId)

    if (!targetLoan || targetLoan.returnedAt) {
      flash('Choose an active loan to renew.')
      return
    }

    const renewedDueDate = addDays(targetLoan.dueDate || referenceDate, extraDays || 7)

    setLoans((currentLoans) =>
      currentLoans.map((loan) =>
        loan.id === loanId
          ? {
              ...loan,
              dueDate: renewedDueDate,
              renewals: (loan.renewals || 0) + 1,
              updatedAt: referenceDate,
            }
          : loan,
      ),
    )

    setBooks((currentBooks) =>
      currentBooks.map((book) =>
        book.id === targetLoan.bookId
          ? {
              ...book,
              dueDate: renewedDueDate,
              updatedAt: referenceDate,
            }
          : book,
      ),
    )

    addActivity({
      group: 'circulation',
      type: 'renew',
      bookTitle: targetLoan.bookTitle,
      memberName: targetLoan.memberName,
      detail: `Renewed to ${formatDate(renewedDueDate)}${note.trim() ? ` · ${note.trim()}` : ''}.`,
      date: referenceDate,
      tone: 'accent',
    })
    flash(`${targetLoan.bookTitle} renewed.`)
    resetCirculationForm('renew')
  }

  function handleCirculationSubmit(event) {
    event.preventDefault()

    const mode = circulationForm.mode

    if (mode === 'issue') {
      issueBook(circulationForm.bookId, circulationForm.memberId, Number(circulationForm.dueDays) || prefs.defaultLoanDays, circulationForm.note)
      return
    }

    if (mode === 'return') {
      returnLoan(circulationForm.loanId, circulationForm.note)
      return
    }

    if (mode === 'reserve') {
      reserveBook(circulationForm.bookId, circulationForm.memberId, circulationForm.note)
      return
    }

    if (mode === 'renew') {
      renewLoan(circulationForm.loanId, Number(circulationForm.extraDays) || 7, circulationForm.note)
    }
  }

  function handleLoadDemo() {
    if (typeof window !== 'undefined' && books.length > 0 && !window.confirm('Replace the current library data with demo content?')) {
      return
    }

    setBooks(DEMO_DATA.books)
    setMembers(DEMO_DATA.members)
    setLoans(DEMO_DATA.loans)
    setActivity(DEMO_DATA.activity)
    setPrefs(DEMO_DATA.prefs)
    resetBookForm()
    resetMemberForm()
    resetCirculationForm(DEMO_DATA.prefs.defaultLoanDays)
    setBookSearch('')
    setBookStatusFilter('all')
    setGenreFilter('all')
    setBookSort('recent')
    setMemberSearch('')
    setMemberRoleFilter('all')
    setMemberSort('recent')
    setActivityFilter('all')
    flash('Demo library loaded.')
  }

  function handleClearAll() {
    if (typeof window !== 'undefined' && !window.confirm('Clear all library data from this browser?')) {
      return
    }

    setBooks([])
    setMembers([])
    setLoans([])
    setActivity([])
    resetBookForm()
    resetMemberForm()
    resetCirculationForm(prefs.defaultLoanDays)
    setBookSearch('')
    setBookStatusFilter('all')
    setGenreFilter('all')
    setBookSort('recent')
    setMemberSearch('')
    setMemberRoleFilter('all')
    setMemberSort('recent')
    setActivityFilter('all')
    flash('Library data cleared.')
  }

  function exportJsonBackup() {
    const payload = JSON.stringify({ books, members, loans, activity, prefs }, null, 2)
    downloadTextFile('library-atlas-backup.json', payload, 'application/json;charset=utf-8;')
    addActivity({
      group: 'system',
      type: 'export',
      detail: 'Full JSON backup exported.',
      date: referenceDate,
      tone: 'primary',
    })
    flash('JSON backup exported.')
  }

  function exportCatalogCsv() {
    const header = ['Title', 'Author', 'Genre', 'Shelf', 'ISBN', 'Year', 'Pages', 'Rating', 'Status', 'Borrower', 'Due Date', 'Reserved By', 'Tags', 'Summary']
    const rows = books.map((book) => {
      const status = resolveBookStatus(book, activeLoanMap)
      const activeLoan = activeLoanMap.get(book.id)
      const borrower = activeLoan ? memberLookup.get(activeLoan.memberId)?.name || activeLoan.memberName : ''
      const reservedMember = book.reservedById ? memberLookup.get(book.reservedById)?.name || '' : ''

      return [
        book.title,
        book.author,
        book.genre,
        book.shelf,
        book.isbn,
        book.year,
        book.pages,
        book.rating,
        status,
        borrower,
        activeLoan?.dueDate || book.dueDate || '',
        reservedMember,
        book.tags.join(' | '),
        book.summary,
      ]
    })

    const csv = [header, ...rows].map((row) => row.map(escapeCsvValue).join(',')).join('\n')
    downloadTextFile('library-atlas-catalog.csv', csv, 'text/csv;charset=utf-8;')
    addActivity({
      group: 'system',
      type: 'export',
      detail: 'Catalog CSV exported.',
      date: referenceDate,
      tone: 'primary',
    })
    flash('Catalog CSV exported.')
  }

  function exportCirculationCsv() {
    const header = ['Issued At', 'Book', 'Member', 'Due Date', 'Returned At', 'Status', 'Fine', 'Renewals', 'Note', 'Return Note']
    const rows = loans.map((loan) => [
      loan.issuedAt,
      loan.bookTitle,
      loan.memberName,
      loan.dueDate,
      loan.returnedAt || '',
      loan.status,
      loan.fineAccrued,
      loan.renewals,
      loan.note,
      loan.returnNote,
    ])

    const csv = [header, ...rows].map((row) => row.map(escapeCsvValue).join(',')).join('\n')
    downloadTextFile('library-atlas-circulation.csv', csv, 'text/csv;charset=utf-8;')
    addActivity({
      group: 'system',
      type: 'export',
      detail: 'Circulation CSV exported.',
      date: referenceDate,
      tone: 'primary',
    })
    flash('Circulation CSV exported.')
  }

  async function handleImportBackup(event) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    try {
      const text = await file.text()
      const parsed = safeParseJSON(text, null)

      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Invalid backup file')
      }

      const nextBooks = Array.isArray(parsed.books) ? parsed.books.map(normalizeBook) : []
      const nextMembers = Array.isArray(parsed.members) ? parsed.members.map(normalizeMember) : []
      const nextLoans = Array.isArray(parsed.loans) ? parsed.loans.map(normalizeLoan) : []
      const nextActivity = Array.isArray(parsed.activity) ? parsed.activity.map(normalizeActivity) : []

      if (nextBooks.length === 0 || nextMembers.length === 0) {
        throw new Error('Backup must include books and members')
      }

      setBooks(nextBooks)
      setMembers(nextMembers)
      setLoans(nextLoans)
      setActivity(nextActivity.length > 0 ? nextActivity : DEMO_DATA.activity)
      setPrefs({
        ...prefs,
        ...(parsed.prefs || {}),
        theme: parsed.prefs?.theme === 'dark' ? 'dark' : 'light',
        currency: CURRENCY_OPTIONS.includes(parsed.prefs?.currency) ? parsed.prefs.currency : prefs.currency,
        defaultLoanDays: Number.isFinite(Number(parsed.prefs?.defaultLoanDays))
          ? clamp(Number(parsed.prefs.defaultLoanDays), 1, 90)
          : prefs.defaultLoanDays,
        finePerDay: Number.isFinite(Number(parsed.prefs?.finePerDay))
          ? clamp(Number(parsed.prefs.finePerDay), 0, 1000)
          : prefs.finePerDay,
      })
      resetBookForm()
      resetMemberForm()
      resetCirculationForm(parsed.prefs?.defaultLoanDays || prefs.defaultLoanDays)
      flash('Backup imported.')
      addActivity({
        group: 'system',
        type: 'import',
        detail: 'JSON backup imported successfully.',
        date: referenceDate,
        tone: 'success',
      })
    } catch {
      flash('Import failed. Use a valid Library Atlas backup file.')
    }
  }

  function clearBookFilters() {
    setBookSearch('')
    setBookStatusFilter('all')
    setGenreFilter('all')
    setBookSort('recent')
    flash('Book filters reset.')
  }

  function clearMemberFilters() {
    setMemberSearch('')
    setMemberRoleFilter('all')
    setMemberSort('recent')
    flash('Member filters reset.')
  }

  function clearActivityFilters() {
    setActivityFilter('all')
    flash('Activity filters reset.')
  }

  const totalBooks = bookStats.total
  const booksShown = filteredBooks.length
  const membersShown = filteredMembers.length
  const activityShown = filteredActivity.length
  const overdueFine = overdueLoans.reduce((sum, loan) => sum + getLoanStatusMeta(loan, prefs.finePerDay, referenceDate).fine, 0)
  const healthyLoans = activeLoans.length - overdueLoans.length
  const availabilityPercent = totalBooks > 0 ? Math.round(((bookStats.available + bookStats.reserved) / totalBooks) * 100) : 0

  return (
    <div className="app-shell" data-theme={prefs.theme}>
      <div className="orb orb-a" />
      <div className="orb orb-b" />

      <main className="library-dashboard">
        <header className="hero">
          <div className="hero-copy panel">
            <div className="eyebrow-row">
              <span className="eyebrow">Library Atlas</span>
              <span className="eyebrow-subtle">Digital circulation desk</span>
            </div>
            <h1>Run a library like a calm, premium command center.</h1>
            <p className="hero-text">
              Manage books, members, circulation, fines, and reservations from one polished React dashboard.
              The data stays in your browser, demo content loads instantly, and every major workflow is a click away.
            </p>

            <div className="hero-badges">
              <span>Catalog + members</span>
              <span>Issue / return / reserve</span>
              <span>Overdue tracking</span>
              <span>JSON and CSV export</span>
            </div>

            <div className="hero-actions">
              <button type="button" className="button button-primary" onClick={handleLoadDemo}>
                Load demo library
              </button>
              <button type="button" className="button button-secondary" onClick={exportJsonBackup}>
                Export backup
              </button>
              <button type="button" className="button button-secondary" onClick={handleThemeToggle}>
                {prefs.theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
              </button>
            </div>
          </div>

          <div className="hero-summary panel">
            <div className="hero-summary-top">
              <span>Catalog pulse</span>
              <strong>{totalBooks} titles</strong>
              <p>{bookStats.healthScore}% shelf health across active collection</p>
            </div>

            <div className="hero-summary-grid">
              <article>
                <span>Available</span>
                <strong>{bookStats.available}</strong>
              </article>
              <article>
                <span>Borrowed</span>
                <strong>{bookStats.borrowed}</strong>
              </article>
              <article>
                <span>Overdue</span>
                <strong>{bookStats.overdue}</strong>
              </article>
              <article>
                <span>Fine exposure</span>
                <strong>{formatCurrency(outstandingFine, prefs.currency)}</strong>
              </article>
            </div>
          </div>
        </header>

        {statusMessage ? <div className="status-banner">{statusMessage}</div> : null}

        <section className="stats-grid">
          <StatCard label="Active members" value={bookStats.activeMembers} detail="Enabled library accounts" tone="accent" />
          <StatCard label="Reservations" value={bookStats.reserved} detail="Books on hold" tone="warn" />
          <StatCard label="Due soon" value={bookStats.dueSoon} detail="Within the next 3 days" tone="primary" />
          <StatCard label="Lost / archived" value={`${bookStats.lost} / ${bookStats.archived}`} detail="Removed from active lending" tone="danger" />
          <StatCard label="Featured titles" value={bookStats.featured} detail="Curated spotlight books" tone="success" />
          <StatCard label="Availability" value={`${availabilityPercent}%`} detail="Ready to lend or reserve" tone="muted" />
        </section>

        <section className="workspace-grid">
          <aside className="panel control-panel">
            <PanelBlock
              kicker="Catalog"
              title={editingBookId ? 'Edit a book' : 'Add a book'}
              description="Maintain titles, genres, shelf codes, ratings, tags, and featured books."
              action={editingBookId ? <button type="button" className="text-button" onClick={resetBookForm}>Cancel</button> : null}
            >
              <form className="stack-form" onSubmit={handleSubmitBook}>
                <div className="form-row two-up">
                  <label className="field">
                    <span>Title</span>
                    <input type="text" value={bookForm.title} onChange={(event) => setBookForm((current) => ({ ...current, title: event.target.value }))} placeholder="Book title" required />
                  </label>
                  <label className="field">
                    <span>Author</span>
                    <input type="text" value={bookForm.author} onChange={(event) => setBookForm((current) => ({ ...current, author: event.target.value }))} placeholder="Author name" required />
                  </label>
                </div>

                <div className="form-row three-up">
                  <label className="field">
                    <span>Genre</span>
                    <select value={bookForm.genre} onChange={(event) => setBookForm((current) => ({ ...current, genre: event.target.value }))}>
                      {BOOK_GENRES.map((genre) => (
                        <option key={genre} value={genre}>{genre}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Shelf</span>
                    <input type="text" value={bookForm.shelf} onChange={(event) => setBookForm((current) => ({ ...current, shelf: event.target.value }))} placeholder="A-1" />
                  </label>
                  <label className="field">
                    <span>Cover hue</span>
                    <input type="number" min="0" max="360" value={bookForm.coverHue} onChange={(event) => setBookForm((current) => ({ ...current, coverHue: event.target.value }))} />
                  </label>
                </div>

                <div className="form-row three-up">
                  <label className="field">
                    <span>ISBN</span>
                    <input type="text" value={bookForm.isbn} onChange={(event) => setBookForm((current) => ({ ...current, isbn: event.target.value }))} placeholder="978..." />
                  </label>
                  <label className="field">
                    <span>Year</span>
                    <input type="number" min="1450" max="2100" value={bookForm.year} onChange={(event) => setBookForm((current) => ({ ...current, year: event.target.value }))} />
                  </label>
                  <label className="field">
                    <span>Pages</span>
                    <input type="number" min="1" value={bookForm.pages} onChange={(event) => setBookForm((current) => ({ ...current, pages: event.target.value }))} placeholder="320" />
                  </label>
                </div>

                <div className="form-row three-up">
                  <label className="field">
                    <span>Rating</span>
                    <input type="number" min="0" max="5" step="0.1" value={bookForm.rating} onChange={(event) => setBookForm((current) => ({ ...current, rating: event.target.value }))} />
                  </label>
                  <label className="field">
                    <span>Tags</span>
                    <input type="text" value={bookForm.tags} onChange={(event) => setBookForm((current) => ({ ...current, tags: event.target.value }))} placeholder="research, ux, classic" />
                  </label>
                  <label className="checkbox-field">
                    <input type="checkbox" checked={bookForm.featured} onChange={(event) => setBookForm((current) => ({ ...current, featured: event.target.checked }))} />
                    <span>Featured book</span>
                  </label>
                </div>

                <label className="field">
                  <span>Summary</span>
                  <textarea rows="3" value={bookForm.summary} onChange={(event) => setBookForm((current) => ({ ...current, summary: event.target.value }))} placeholder="A short description of the book" />
                </label>

                <div className="form-actions">
                  <button type="submit" className="button button-primary">{editingBookId ? 'Update book' : 'Save book'}</button>
                  <button type="button" className="button button-secondary" onClick={resetBookForm}>Reset</button>
                </div>
              </form>
            </PanelBlock>

            <PanelBlock kicker="Members" title={editingMemberId ? 'Edit a member' : 'Add a member'} description="Track students, faculty, guests, and active or inactive accounts.">
              <form className="stack-form" onSubmit={handleSubmitMember}>
                <div className="form-row two-up">
                  <label className="field">
                    <span>Name</span>
                    <input type="text" value={memberForm.name} onChange={(event) => setMemberForm((current) => ({ ...current, name: event.target.value }))} placeholder="Member name" required />
                  </label>
                  <label className="field">
                    <span>Role</span>
                    <select value={memberForm.role} onChange={(event) => setMemberForm((current) => ({ ...current, role: event.target.value }))}>
                      {MEMBER_ROLES.map((role) => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="form-row two-up">
                  <label className="field">
                    <span>Email</span>
                    <input type="email" value={memberForm.email} onChange={(event) => setMemberForm((current) => ({ ...current, email: event.target.value }))} placeholder="name@example.com" />
                  </label>
                  <label className="field">
                    <span>Phone</span>
                    <input type="text" value={memberForm.phone} onChange={(event) => setMemberForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Phone number" />
                  </label>
                </div>

                <div className="form-row two-up">
                  <label className="field">
                    <span>Department</span>
                    <input type="text" value={memberForm.department} onChange={(event) => setMemberForm((current) => ({ ...current, department: event.target.value }))} placeholder="Department or subject" />
                  </label>
                  <label className="checkbox-field">
                    <input type="checkbox" checked={memberForm.active} onChange={(event) => setMemberForm((current) => ({ ...current, active: event.target.checked }))} />
                    <span>Member is active</span>
                  </label>
                </div>

                <label className="field">
                  <span>Notes</span>
                  <textarea rows="3" value={memberForm.notes} onChange={(event) => setMemberForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Internal notes or preferences" />
                </label>

                <div className="form-actions">
                  <button type="submit" className="button button-primary">{editingMemberId ? 'Update member' : 'Save member'}</button>
                  <button type="button" className="button button-secondary" onClick={resetMemberForm}>Reset</button>
                </div>
              </form>
            </PanelBlock>

            <PanelBlock kicker="Circulation" title="Issue, return, reserve, renew" description="Use the circulation desk for book movement and due date management.">
              <form className="stack-form" onSubmit={handleCirculationSubmit}>
                <label className="field">
                  <span>Action</span>
                  <select value={circulationForm.mode} onChange={(event) => prepareCirculation(event.target.value)}>
                    {CIRCULATION_MODES.map((mode) => (
                      <option key={mode.value} value={mode.value}>{mode.label}</option>
                    ))}
                  </select>
                </label>

                {circulationForm.mode === 'issue' ? (
                  <>
                    <div className="form-row two-up">
                      <label className="field">
                        <span>Book</span>
                        <select value={circulationForm.bookId} onChange={(event) => setCirculationForm((current) => ({ ...current, bookId: event.target.value }))}>
                          <option value="">Select a book</option>
                          {bookOptions.map((book) => (
                            <option key={book.id} value={book.id}>{book.title} · {getStatusLabel(resolveBookStatus(book, activeLoanMap))}</option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span>Member</span>
                        <select value={circulationForm.memberId} onChange={(event) => setCirculationForm((current) => ({ ...current, memberId: event.target.value }))}>
                          <option value="">Select a member</option>
                          {activeMemberOptions.map((member) => (
                            <option key={member.id} value={member.id}>{member.name} · {member.role}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="form-row two-up">
                      <label className="field">
                        <span>Due in days</span>
                        <input type="number" min="1" max="90" value={circulationForm.dueDays} onChange={(event) => setCirculationForm((current) => ({ ...current, dueDays: event.target.value }))} />
                      </label>
                      <label className="field">
                        <span>Note</span>
                        <input type="text" value={circulationForm.note} onChange={(event) => setCirculationForm((current) => ({ ...current, note: event.target.value }))} placeholder="Optional note" />
                      </label>
                    </div>
                  </>
                ) : null}

                {circulationForm.mode === 'return' ? (
                  <>
                    <label className="field">
                      <span>Active loan</span>
                      <select value={circulationForm.loanId} onChange={(event) => setCirculationForm((current) => ({ ...current, loanId: event.target.value }))}>
                        <option value="">Select a loan</option>
                        {currentLoanOptions.map((loan) => (
                          <option key={loan.id} value={loan.id}>{loan.bookTitle} · {loan.memberName}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Return note</span>
                      <input type="text" value={circulationForm.note} onChange={(event) => setCirculationForm((current) => ({ ...current, note: event.target.value }))} placeholder="Optional return note" />
                    </label>
                  </>
                ) : null}

                {circulationForm.mode === 'reserve' ? (
                  <>
                    <div className="form-row two-up">
                      <label className="field">
                        <span>Book</span>
                        <select value={circulationForm.bookId} onChange={(event) => setCirculationForm((current) => ({ ...current, bookId: event.target.value }))}>
                          <option value="">Select a book</option>
                          {bookOptions.map((book) => (
                            <option key={book.id} value={book.id}>{book.title}</option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span>Member</span>
                        <select value={circulationForm.memberId} onChange={(event) => setCirculationForm((current) => ({ ...current, memberId: event.target.value }))}>
                          <option value="">Select a member</option>
                          {activeMemberOptions.map((member) => (
                            <option key={member.id} value={member.id}>{member.name}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="field">
                      <span>Reservation note</span>
                      <input type="text" value={circulationForm.note} onChange={(event) => setCirculationForm((current) => ({ ...current, note: event.target.value }))} placeholder="Optional reservation note" />
                    </label>
                  </>
                ) : null}

                {circulationForm.mode === 'renew' ? (
                  <>
                    <label className="field">
                      <span>Active loan</span>
                      <select value={circulationForm.loanId} onChange={(event) => setCirculationForm((current) => ({ ...current, loanId: event.target.value }))}>
                        <option value="">Select a loan</option>
                        {currentLoanOptions.map((loan) => (
                          <option key={loan.id} value={loan.id}>{loan.bookTitle} · {loan.memberName}</option>
                        ))}
                      </select>
                    </label>
                    <div className="form-row two-up">
                      <label className="field">
                        <span>Extend by days</span>
                        <input type="number" min="1" max="90" value={circulationForm.extraDays} onChange={(event) => setCirculationForm((current) => ({ ...current, extraDays: event.target.value }))} />
                      </label>
                      <label className="field">
                        <span>Renewal note</span>
                        <input type="text" value={circulationForm.note} onChange={(event) => setCirculationForm((current) => ({ ...current, note: event.target.value }))} placeholder="Optional renewal note" />
                      </label>
                    </div>
                  </>
                ) : null}

                <div className="form-actions">
                  <button type="submit" className="button button-primary">
                    {circulationForm.mode === 'issue' ? 'Issue book' : circulationForm.mode === 'return' ? 'Check in book' : circulationForm.mode === 'reserve' ? 'Reserve book' : 'Renew loan'}
                  </button>
                  <button type="button" className="button button-secondary" onClick={() => resetCirculationForm(prefs.defaultLoanDays)}>Reset</button>
                </div>
              </form>
            </PanelBlock>

            <PanelBlock
              kicker="Settings"
              title="Library preferences and tools"
              description="Tune loan period, fine rate, theme, and backup/export actions."
            >
              <div className="settings-grid">
                <label className="field compact">
                  <span>Currency</span>
                  <select value={prefs.currency} onChange={(event) => handleSettingChange('currency', event.target.value)}>
                    {CURRENCY_OPTIONS.map((currency) => (
                      <option key={currency} value={currency}>{currency}</option>
                    ))}
                  </select>
                </label>

                <label className="field compact">
                  <span>Default loan days</span>
                  <input type="number" min="1" max="90" value={prefs.defaultLoanDays} onChange={(event) => handleSettingChange('defaultLoanDays', clamp(Number(event.target.value) || 1, 1, 90))} />
                </label>

                <label className="field compact">
                  <span>Fine per day</span>
                  <input type="number" min="0" max="1000" value={prefs.finePerDay} onChange={(event) => handleSettingChange('finePerDay', clamp(Number(event.target.value) || 0, 0, 1000))} />
                </label>

                <button type="button" className="theme-toggle" onClick={handleThemeToggle}>
                  <span>Theme</span>
                  <strong>{prefs.theme === 'dark' ? 'Dark' : 'Light'}</strong>
                </button>
              </div>

              <div className="utility-grid">
                <button type="button" className="button button-secondary" onClick={exportCatalogCsv}>Export catalog CSV</button>
                <button type="button" className="button button-secondary" onClick={exportCirculationCsv}>Export circulation CSV</button>
                <button type="button" className="button button-secondary" onClick={() => importInputRef.current?.click()}>Import JSON</button>
                <button type="button" className="button button-danger" onClick={handleClearAll}>Clear all</button>
              </div>

              <div className="utility-grid">
                <button type="button" className="button button-primary" onClick={handleLoadDemo}>Load demo data</button>
                <button type="button" className="button button-secondary" onClick={exportJsonBackup}>Export JSON backup</button>
              </div>
            </PanelBlock>
          </aside>

          <section className="panel analytics-panel">
            <PanelBlock kicker="Analytics" title="Library health and circulation trends" description="A quick read on lending pressure, genre balance, and overdue risk.">
              <div className="metric-grid">
                <StatCard label="Total books" value={totalBooks} detail="Active catalog entries" tone="primary" />
                <StatCard label="Borrowed" value={bookStats.borrowed} detail={`${healthyLoans} on track`} tone="warn" />
                <StatCard label="Overdue" value={bookStats.overdue} detail={`${formatCurrency(overdueFine, prefs.currency)} estimated late fees`} tone="danger" />
                <StatCard label="Members" value={members.length} detail="Registered readers" tone="accent" />
              </div>

              <div className="insight-grid">
                <article className="insight-card">
                  <div className="insight-head">
                    <div>
                      <span className="section-kicker">Status mix</span>
                      <h4>Catalog balance</h4>
                    </div>
                    <Chip tone="muted">{availabilityPercent}% available</Chip>
                  </div>
                  <div className="bar-list">
                    {statusBreakdown.map((item) => {
                      const percent = totalBooks > 0 ? Math.max(6, Math.round((item.count / totalBooks) * 100)) : 0
                      return (
                        <div key={item.status} className="bar-row">
                          <div className="bar-row-topline">
                            <span>{getStatusLabel(item.status)}</span>
                            <strong>{item.count}</strong>
                          </div>
                          <div className="bar-track">
                            <div className={`bar-fill fill-${getStatusTone(item.status)}`} style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </article>

                <article className="insight-card">
                  <div className="insight-head">
                    <div>
                      <span className="section-kicker">Genres</span>
                      <h4>Reading mix</h4>
                    </div>
                    {mostBorrowedBook ? <Chip tone="accent">Top loaned: {mostBorrowedBook.title}</Chip> : null}
                  </div>
                  <div className="bar-list">
                    {genreBreakdown.map((item) => {
                      const percent = totalBooks > 0 ? Math.max(8, Math.round((item.count / totalBooks) * 100)) : 0
                      return (
                        <div key={item.genre} className="bar-row">
                          <div className="bar-row-topline">
                            <span>{item.genre}</span>
                            <strong>{item.count}</strong>
                          </div>
                          <div className="bar-track">
                            <div className="bar-fill fill-accent" style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </article>
              </div>

              <div className="due-grid">
                <article className="insight-card compact-card">
                  <div className="insight-head">
                    <div>
                      <span className="section-kicker">Overdue</span>
                      <h4>Needs attention</h4>
                    </div>
                    <Chip tone="danger">{overdueLoans.length}</Chip>
                  </div>
                  <div className="loan-list">
                    {overdueLoans.length > 0 ? overdueLoans.slice(0, 4).map((loan) => {
                      const meta = getLoanStatusMeta(loan, prefs.finePerDay, referenceDate)
                      return (
                        <div key={loan.id} className="loan-row">
                          <div>
                            <strong>{loan.bookTitle}</strong>
                            <p>{loan.memberName}</p>
                          </div>
                          <div className="loan-row-right">
                            <span>{meta.label}</span>
                            <strong>{formatCurrency(meta.fine, prefs.currency)}</strong>
                          </div>
                        </div>
                      )
                    }) : <p className="empty-copy">No overdue books right now.</p>}
                  </div>
                </article>

                <article className="insight-card compact-card">
                  <div className="insight-head">
                    <div>
                      <span className="section-kicker">Due soon</span>
                      <h4>Return window</h4>
                    </div>
                    <Chip tone="warn">{dueSoonLoans.length}</Chip>
                  </div>
                  <div className="loan-list">
                    {dueSoonLoans.length > 0 ? dueSoonLoans.slice(0, 4).map((loan) => {
                      const meta = getLoanStatusMeta(loan, prefs.finePerDay, referenceDate)
                      return (
                        <div key={loan.id} className="loan-row">
                          <div>
                            <strong>{loan.bookTitle}</strong>
                            <p>{loan.memberName}</p>
                          </div>
                          <div className="loan-row-right">
                            <span>{meta.label}</span>
                            <strong>{formatDate(loan.dueDate)}</strong>
                          </div>
                        </div>
                      )
                    }) : <p className="empty-copy">Nothing is due in the next few days.</p>}
                  </div>
                </article>
              </div>
            </PanelBlock>
          </section>
        </section>

        <section className="panel catalog-panel">
          <div className="section-heading catalog-heading">
            <div>
              <span className="section-kicker">Catalog</span>
              <h2>Book collection</h2>
            </div>
            <div className="catalog-summary">
              <Chip tone="muted">{booksShown} shown</Chip>
              <Chip tone="muted">{totalBooks} total</Chip>
            </div>
          </div>

          <div className="filter-bar">
            <label className="field compact search-field">
              <span>Search</span>
              <input type="search" value={bookSearch} onChange={(event) => setBookSearch(event.target.value)} placeholder="Title, author, ISBN, shelf, tags" />
            </label>
            <label className="field compact">
              <span>Status</span>
              <select value={bookStatusFilter} onChange={(event) => setBookStatusFilter(event.target.value)}>
                <option value="all">All statuses</option>
                {BOOK_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>{getStatusLabel(status)}</option>
                ))}
              </select>
            </label>
            <label className="field compact">
              <span>Genre</span>
              <select value={genreFilter} onChange={(event) => setGenreFilter(event.target.value)}>
                <option value="all">All genres</option>
                {BOOK_GENRES.map((genre) => (
                  <option key={genre} value={genre}>{genre}</option>
                ))}
              </select>
            </label>
            <label className="field compact">
              <span>Sort</span>
              <select value={bookSort} onChange={(event) => setBookSort(event.target.value)}>
                {BOOK_SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <button type="button" className="button button-secondary clear-button" onClick={clearBookFilters}>Reset filters</button>
          </div>

          <div className="book-grid">
            {filteredBooks.length > 0 ? filteredBooks.map((book) => {
              const status = resolveBookStatus(book, activeLoanMap)
              const activeLoan = activeLoanMap.get(book.id) || null
              const borrower = activeLoan ? memberLookup.get(activeLoan.memberId) || null : null
              const reservedMember = book.reservedById ? memberLookup.get(book.reservedById) || null : null
              const issueTargetMemberId = selectFallbackMemberId(reservedMember?.id || borrower?.id)

              return (
                <BookCard
                  key={book.id}
                  book={book}
                  status={status}
                  activeLoan={activeLoan}
                  borrower={borrower}
                  reservedMember={reservedMember}
                  currency={prefs.currency}
                  onEdit={() => handleEditBook(book)}
                  onDelete={() => handleDeleteBook(book.id)}
                  onArchive={() => handleArchiveBook(book.id)}
                  onRestore={() => handleRestoreBook(book.id)}
                  onMarkLost={() => handleMarkLost(book.id)}
                  onPrepareCirculation={{
                    issue: () => prepareCirculation('issue', {
                      bookId: book.id,
                      memberId: issueTargetMemberId,
                      dueDays: String(prefs.defaultLoanDays),
                      note: '',
                    }),
                    reserve: () => prepareCirculation('reserve', {
                      bookId: book.id,
                      memberId: selectFallbackMemberId(reservedMember?.id || borrower?.id),
                      note: '',
                    }),
                    return: () => prepareCirculation('return', {
                      loanId: activeLoan?.id || '',
                      note: '',
                    }),
                    renew: () => prepareCirculation('renew', {
                      loanId: activeLoan?.id || '',
                      extraDays: '7',
                      note: '',
                    }),
                  }}
                />
              )
            }) : (
              <div className="empty-state">
                <h3>No matching books</h3>
                <p>Adjust your filters or load the demo library to explore the catalog layout and circulation tools.</p>
                <div className="empty-actions">
                  <button type="button" className="button button-primary" onClick={handleLoadDemo}>Load demo data</button>
                  <button type="button" className="button button-secondary" onClick={clearBookFilters}>Reset filters</button>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="directory-grid">
          <section className="panel member-panel">
            <div className="section-heading">
              <div>
                <span className="section-kicker">Members</span>
                <h2>Reader directory</h2>
              </div>
              <div className="catalog-summary">
                <Chip tone="muted">{membersShown} shown</Chip>
                <Chip tone="muted">{members.length} total</Chip>
              </div>
            </div>

            <div className="filter-bar member-filter-bar">
              <label className="field compact search-field">
                <span>Search</span>
                <input type="search" value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Name, role, department, notes" />
              </label>
              <label className="field compact">
                <span>Role</span>
                <select value={memberRoleFilter} onChange={(event) => setMemberRoleFilter(event.target.value)}>
                  <option value="all">All roles</option>
                  {MEMBER_ROLES.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </label>
              <label className="field compact">
                <span>Sort</span>
                <select value={memberSort} onChange={(event) => setMemberSort(event.target.value)}>
                  {MEMBER_SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <button type="button" className="button button-secondary clear-button" onClick={clearMemberFilters}>Reset filters</button>
            </div>

            <div className="member-grid">
              {filteredMembers.length > 0 ? filteredMembers.map((member) => {
                const stats = loanStatsByMember.get(member.id) || { activeLoans: 0, totalLoans: 0, fineDue: 0, borrowedTitles: [] }
                return (
                  <MemberCard
                    key={member.id}
                    member={member}
                    stats={stats}
                    currency={prefs.currency}
                    onEdit={() => handleEditMember(member)}
                    onToggleActive={() => handleToggleMember(member.id)}
                    onDelete={() => handleDeleteMember(member.id)}
                    onPrepareIssue={() => prepareCirculation('issue', {
                      memberId: member.id,
                      bookId: bookOptions[0]?.id || '',
                      dueDays: String(prefs.defaultLoanDays),
                      note: '',
                    })}
                  />
                )
              }) : (
                <div className="empty-state">
                  <h3>No matching members</h3>
                  <p>Broaden the search or add a new member using the control panel.</p>
                  <button type="button" className="button button-secondary" onClick={clearMemberFilters}>Reset filters</button>
                </div>
              )}
            </div>
          </section>

          <section className="panel activity-panel">
            <div className="section-heading">
              <div>
                <span className="section-kicker">Activity</span>
                <h2>Recent actions</h2>
              </div>
              <div className="catalog-summary">
                <Chip tone="muted">{activityShown} shown</Chip>
              </div>
            </div>

            <div className="filter-bar activity-filter-bar">
              <label className="field compact">
                <span>Type</span>
                <select value={activityFilter} onChange={(event) => setActivityFilter(event.target.value)}>
                  {ACTIVITY_FILTER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <button type="button" className="button button-secondary clear-button" onClick={clearActivityFilters}>Reset filters</button>
              <button type="button" className="button button-secondary clear-button" onClick={exportCirculationCsv}>Export circulation CSV</button>
            </div>

            <div className="activity-list">
              {filteredActivity.length > 0 ? filteredActivity.map((entry) => (
                <ActivityRow key={entry.id} activity={entry} />
              )) : (
                <div className="empty-state">
                  <h3>No recent activity</h3>
                  <p>Load the demo library or perform a circulation action to populate the activity feed.</p>
                </div>
              )}
            </div>
          </section>
        </section>

        <input ref={importInputRef} className="visually-hidden" type="file" accept="application/json" onChange={handleImportBackup} />
      </main>
    </div>
  )
}

export default App
