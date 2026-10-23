import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'

const DEFAULT_CATEGORIES = [
  'Продукты',
  'Кафе и рестораны',
  'Автомобиль',
  'Транспорт',
  'Дом',
  'Коммунальные',
  'Здоровье',
  'Одежда',
  'Развлечения',
  'Подписки',
  'Путешествия',
  'Дети',
  'Подарки',
  'Прочее',
]

const DEFAULT_INCOME_CATEGORIES = [
  'Зарплата',
  'Фриланс',
  'Возвраты',
  'Подарки',
  'Прочее',
]

const PERIODS = [
  ['today', 'Сегодня'],
  ['this-week', 'Эта неделя'],
  ['last-7-days', 'Последние 7 дней'],
  ['last-30-days', 'Последние 30 дней'],
  ['this-month', 'Этот месяц'],
  ['last-month', 'Прошлый месяц'],
  ['3-months', '3 месяца'],
  ['year', 'Этот год'],
  ['all', 'Всё время'],
  ['custom', 'Свой период'],
]

const SORT_OPTIONS = [
  ['date-desc', 'Сначала новые'],
  ['date-asc', 'Сначала старые'],
  ['amount-desc', 'Сумма: по убыванию'],
  ['amount-asc', 'Сумма: по возрастанию'],
]

const CHART_COLORS = [
  '#111827', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444',
  '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#64748b', '#14b8a6',
]

const formatMoney = (value) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(Number(value || 0))

const isoDate = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const parseIsoDate = (value) => {
  const [year, month, day] = String(value).split('-').map(Number)
  return new Date(year, month - 1, day)
}

const formatDate = (value) => {
  if (!value) return ''
  const [year, month, day] = String(value).split('-')
  if (!year || !month || !day) return value
  return `${day}.${month}.${year}`
}

const monthKey = (date = new Date()) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

const getMonthRange = (month) => {
  const [year, monthNumber] = String(month).split('-').map(Number)
  if (!year || !monthNumber) return { from: null, to: null }
  const lastDay = new Date(year, monthNumber, 0).getDate()
  return {
    from: `${year}-${String(monthNumber).padStart(2, '0')}-01`,
    to: `${year}-${String(monthNumber).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  }
}

const formatMonth = (month) => {
  const [year, monthNumber] = String(month).split('-').map(Number)
  if (!year || !monthNumber) return month
  const label = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' })
    .format(new Date(year, monthNumber - 1, 1))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

const parseMoneyInput = (value) => {
  const normalized = String(value ?? '').trim().replace(',', '.')
  if (!normalized) return null
  const number = Number(normalized)
  return Number.isFinite(number) && number > 0 ? number : null
}

const addDays = (date, days) => {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  result.setDate(result.getDate() + days)
  return result
}

const shiftMonthsClamped = (date, months) => {
  const targetMonth = date.getMonth() + months
  const targetYear = date.getFullYear() + Math.floor(targetMonth / 12)
  const normalizedMonth = ((targetMonth % 12) + 12) % 12
  const lastDay = new Date(targetYear, normalizedMonth + 1, 0).getDate()
  return new Date(targetYear, normalizedMonth, Math.min(date.getDate(), lastDay))
}

const inclusiveDays = (from, to) => {
  if (!from || !to) return null
  const start = parseIsoDate(from)
  const end = parseIsoDate(to)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null
  return Math.round((end - start) / 86400000) + 1
}

function getPeriodRanges(period, customFrom, customTo) {
  const now = new Date()
  let currentFrom = null
  let currentTo = null
  let previousFrom = null
  let previousTo = null

  if (period === 'today') {
    currentFrom = now
    currentTo = now
    previousFrom = addDays(now, -1)
    previousTo = addDays(now, -1)
  } else if (period === 'this-week') {
    const mondayOffset = now.getDay() === 0 ? 6 : now.getDay() - 1
    currentFrom = addDays(now, -mondayOffset)
    currentTo = now
    previousFrom = addDays(currentFrom, -7)
    previousTo = addDays(currentTo, -7)
  } else if (period === 'last-7-days') {
    currentFrom = addDays(now, -6)
    currentTo = now
    previousFrom = addDays(now, -13)
    previousTo = addDays(now, -7)
  } else if (period === 'last-30-days') {
    currentFrom = addDays(now, -29)
    currentTo = now
    previousFrom = addDays(now, -59)
    previousTo = addDays(now, -30)
  } else if (period === 'this-month') {
    currentFrom = new Date(now.getFullYear(), now.getMonth(), 1)
    currentTo = now
    previousFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    previousTo = shiftMonthsClamped(now, -1)
  } else if (period === 'last-month') {
    currentFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    currentTo = new Date(now.getFullYear(), now.getMonth(), 0)
    previousFrom = new Date(now.getFullYear(), now.getMonth() - 2, 1)
    previousTo = new Date(now.getFullYear(), now.getMonth() - 1, 0)
  } else if (period === '3-months') {
    currentFrom = new Date(now.getFullYear(), now.getMonth() - 2, 1)
    currentTo = now
    previousFrom = new Date(now.getFullYear(), now.getMonth() - 5, 1)
    previousTo = shiftMonthsClamped(now, -3)
  } else if (period === 'year') {
    currentFrom = new Date(now.getFullYear(), 0, 1)
    currentTo = now
    previousFrom = new Date(now.getFullYear() - 1, 0, 1)
    previousTo = new Date(
      now.getFullYear() - 1,
      now.getMonth(),
      Math.min(now.getDate(), new Date(now.getFullYear() - 1, now.getMonth() + 1, 0).getDate()),
    )
  } else if (period === 'custom') {
    const current = { from: customFrom || null, to: customTo || null }
    if (!customFrom || !customTo) return { current, previous: null }

    const fromDate = parseIsoDate(customFrom)
    const toDate = parseIsoDate(customTo)
    if (toDate < fromDate) return { current, previous: null }

    const durationDays = Math.round((toDate - fromDate) / 86400000) + 1
    const prevTo = addDays(fromDate, -1)
    const prevFrom = addDays(prevTo, -(durationDays - 1))

    return {
      current,
      previous: { from: isoDate(prevFrom), to: isoDate(prevTo) },
    }
  } else if (period === 'all') {
    return { current: { from: null, to: null }, previous: null }
  }

  return {
    current: {
      from: currentFrom ? isoDate(currentFrom) : null,
      to: currentTo ? isoDate(currentTo) : null,
    },
    previous: previousFrom && previousTo
      ? { from: isoDate(previousFrom), to: isoDate(previousTo) }
      : null,
  }
}

function Login({ onReady }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function sendMagicLink(e) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })

    setLoading(false)
    setMessage(error ? error.message : 'Ссылка для входа отправлена на email.')
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={sendMagicLink}>
        <h1>Мой бюджет</h1>
        <p className="muted">Вход по ссылке на email</p>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button className="primary" disabled={loading}>
          {loading ? 'Отправка…' : 'Войти'}
        </button>
        {message && <div className="notice">{message}</div>}
        <button type="button" className="link-button" onClick={onReady}>
          Проверить вход
        </button>
      </form>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [loadingSession, setLoadingSession] = useState(true)
  const [expenses, setExpenses] = useState([])
  const [previousExpenses, setPreviousExpenses] = useState([])
  const [incomes, setIncomes] = useState([])
  const [previousIncomes, setPreviousIncomes] = useState([])
  const [categories, setCategories] = useState([])
  const [incomeCategories, setIncomeCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [categoryError, setCategoryError] = useState('')
  const [incomeError, setIncomeError] = useState('')
  const [incomeCategoryError, setIncomeCategoryError] = useState('')
  const [budgetError, setBudgetError] = useState('')
  const [budgetSaving, setBudgetSaving] = useState(false)
  const [budgetLoading, setBudgetLoading] = useState(false)

  const [budgetMonth, setBudgetMonth] = useState(monthKey())
  const [monthExpenses, setMonthExpenses] = useState([])
  const [monthIncomes, setMonthIncomes] = useState([])
  const [monthlyBudget, setMonthlyBudget] = useState(null)
  const [categoryLimits, setCategoryLimits] = useState([])
  const [totalBudgetInput, setTotalBudgetInput] = useState('')
  const [categoryLimitInputs, setCategoryLimitInputs] = useState({})

  const [period, setPeriod] = useState('this-month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [sortMode, setSortMode] = useState('date-desc')

  const [date, setDate] = useState(isoDate(new Date()))
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState(DEFAULT_CATEGORIES[0])
  const [note, setNote] = useState('')
  const [editingExpenseId, setEditingExpenseId] = useState(null)

  const [incomeDate, setIncomeDate] = useState(isoDate(new Date()))
  const [incomeAmount, setIncomeAmount] = useState('')
  const [incomeCategory, setIncomeCategory] = useState(DEFAULT_INCOME_CATEGORIES[0])
  const [incomeNote, setIncomeNote] = useState('')
  const [editingIncomeId, setEditingIncomeId] = useState(null)
  const [incomeSortMode, setIncomeSortMode] = useState('date-desc')

  const [newCategory, setNewCategory] = useState('')
  const [editingCategoryId, setEditingCategoryId] = useState(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')
  const [newIncomeCategory, setNewIncomeCategory] = useState('')
  const [editingIncomeCategoryId, setEditingIncomeCategoryId] = useState(null)
  const [editingIncomeCategoryName, setEditingIncomeCategoryName] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoadingSession(false)
    })

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => authListener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user) return
    loadExpenses()
    loadIncomes()
    loadCategories()
    loadIncomeCategories()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, period, customFrom, customTo])

  useEffect(() => {
    if (!session?.user) return
    loadMonthlyBudget()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, budgetMonth])

  const managedCategoryNames = useMemo(
    () => categories.map((item) => item.name),
    [categories],
  )

  const managedIncomeCategoryNames = useMemo(
    () => incomeCategories.map((item) => item.name),
    [incomeCategories],
  )

  const allCategoryNames = useMemo(() => {
    const names = new Set(managedCategoryNames)
    for (const item of expenses) names.add(item.category)
    return [...names].sort((a, b) => a.localeCompare(b, 'ru'))
  }, [managedCategoryNames, expenses])

  useEffect(() => {
    if (managedCategoryNames.length && !managedCategoryNames.includes(category)) {
      setCategory(managedCategoryNames[0])
    }
  }, [managedCategoryNames, category])

  useEffect(() => {
    if (managedIncomeCategoryNames.length && !managedIncomeCategoryNames.includes(incomeCategory)) {
      setIncomeCategory(managedIncomeCategoryNames[0])
    }
  }, [managedIncomeCategoryNames, incomeCategory])

  async function loadCategories() {
    setCategoryError('')

    const { data, error: queryError } = await supabase
      .from('budget_categories')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    if (queryError) {
      setCategoryError(
        queryError.message.includes('budget_categories')
          ? 'Нужно выполнить обновление базы данных для версии 1.1.0.'
          : queryError.message,
      )
      return
    }

    if ((data || []).length === 0) {
      const rows = DEFAULT_CATEGORIES.map((name, index) => ({
        user_id: session.user.id,
        name,
        sort_order: index,
      }))

      const { error: insertError } = await supabase.from('budget_categories').insert(rows)
      if (insertError) {
        setCategoryError(insertError.message)
        return
      }

      const { data: created, error: reloadError } = await supabase
        .from('budget_categories')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })

      if (reloadError) {
        setCategoryError(reloadError.message)
        return
      }
      setCategories(created || [])
      return
    }

    setCategories(data || [])
  }

  async function loadIncomeCategories() {
    setIncomeCategoryError('')

    const { data, error: queryError } = await supabase
      .from('budget_income_categories')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    if (queryError) {
      setIncomeCategoryError(
        queryError.message.includes('budget_income_categories')
          ? 'Нужно выполнить SQL-обновление базы данных для версии 1.5.0.'
          : queryError.message,
      )
      return
    }

    if ((data || []).length === 0) {
      const rows = DEFAULT_INCOME_CATEGORIES.map((name, index) => ({
        user_id: session.user.id,
        name,
        sort_order: index,
      }))

      const { error: insertError } = await supabase.from('budget_income_categories').insert(rows)
      if (insertError) {
        setIncomeCategoryError(insertError.message)
        return
      }

      const { data: created, error: reloadError } = await supabase
        .from('budget_income_categories')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })

      if (reloadError) {
        setIncomeCategoryError(reloadError.message)
        return
      }
      setIncomeCategories(created || [])
      return
    }

    setIncomeCategories(data || [])
  }

  async function loadMonthlyBudget() {
    if (!session?.user || !budgetMonth) return
    setBudgetLoading(true)
    setBudgetError('')

    const range = getMonthRange(budgetMonth)
    const monthDate = `${budgetMonth}-01`

    const [expensesResult, incomesResult, budgetResult, limitsResult] = await Promise.all([
      buildExpenseQuery(range),
      buildIncomeQuery(range),
      supabase
        .from('budget_monthly_settings')
        .select('*')
        .eq('month', monthDate)
        .maybeSingle(),
      supabase
        .from('budget_category_limits')
        .select('*')
        .eq('month', monthDate)
        .order('category', { ascending: true }),
    ])

    setBudgetLoading(false)
    const firstError = expensesResult.error || incomesResult.error || budgetResult.error || limitsResult.error
    if (firstError) {
      setBudgetError(
        /budget_incomes|budget_monthly_settings|budget_category_limits/i.test(firstError.message)
          ? 'Нужно выполнить SQL-обновление базы данных для версии 1.5.0.'
          : firstError.message,
      )
      return
    }

    const nextBudget = budgetResult.data || null
    const nextLimits = limitsResult.data || []
    setMonthExpenses(expensesResult.data || [])
    setMonthIncomes(incomesResult.data || [])
    setMonthlyBudget(nextBudget)
    setCategoryLimits(nextLimits)
    setTotalBudgetInput(nextBudget?.total_limit ? String(nextBudget.total_limit).replace('.', ',') : '')
    setCategoryLimitInputs(
      Object.fromEntries(
        nextLimits.map((item) => [item.category, String(item.limit_amount).replace('.', ',')]),
      ),
    )
  }

  async function saveMonthlyBudget(e) {
    e.preventDefault()
    if (!session?.user || !budgetMonth) return

    setBudgetSaving(true)
    setBudgetError('')
    const monthDate = `${budgetMonth}-01`
    const totalLimit = parseMoneyInput(totalBudgetInput)

    let settingsError = null
    if (totalLimit) {
      const { error: upsertError } = await supabase
        .from('budget_monthly_settings')
        .upsert(
          { user_id: session.user.id, month: monthDate, total_limit: totalLimit },
          { onConflict: 'user_id,month' },
        )
      settingsError = upsertError
    } else {
      const { error: deleteError } = await supabase
        .from('budget_monthly_settings')
        .delete()
        .eq('month', monthDate)
      settingsError = deleteError
    }

    if (settingsError) {
      setBudgetSaving(false)
      setBudgetError(settingsError.message)
      return
    }

    const inputCategoryNames = new Set([
      ...managedCategoryNames,
      ...categoryLimits.map((item) => item.category),
    ])

    for (const categoryName of inputCategoryNames) {
      const limitAmount = parseMoneyInput(categoryLimitInputs[categoryName])
      if (limitAmount) {
        const { error: upsertError } = await supabase
          .from('budget_category_limits')
          .upsert(
            {
              user_id: session.user.id,
              month: monthDate,
              category: categoryName,
              limit_amount: limitAmount,
            },
            { onConflict: 'user_id,month,category' },
          )
        if (upsertError) {
          setBudgetSaving(false)
          setBudgetError(upsertError.message)
          return
        }
      } else {
        const { error: deleteError } = await supabase
          .from('budget_category_limits')
          .delete()
          .eq('month', monthDate)
          .eq('category', categoryName)
        if (deleteError) {
          setBudgetSaving(false)
          setBudgetError(deleteError.message)
          return
        }
      }
    }

    setBudgetSaving(false)
    await loadMonthlyBudget()
  }

  function buildExpenseQuery(range) {
    let query = supabase
      .from('budget_expenses')
      .select('*')
      .order('spent_at', { ascending: false })
      .order('created_at', { ascending: false })

    if (range?.from) query = query.gte('spent_at', range.from)
    if (range?.to) query = query.lte('spent_at', range.to)
    return query
  }

  function buildIncomeQuery(range) {
    let query = supabase
      .from('budget_incomes')
      .select('*')
      .order('received_at', { ascending: false })
      .order('created_at', { ascending: false })

    if (range?.from) query = query.gte('received_at', range.from)
    if (range?.to) query = query.lte('received_at', range.to)
    return query
  }

  async function loadIncomes() {
    setIncomeError('')

    const ranges = getPeriodRanges(period, customFrom, customTo)
    const currentPromise = buildIncomeQuery(ranges.current)
    const previousPromise = ranges.previous
      ? buildIncomeQuery(ranges.previous)
      : Promise.resolve({ data: [], error: null })

    const [currentResult, previousResult] = await Promise.all([currentPromise, previousPromise])

    if (currentResult.error) {
      setIncomeError(
        currentResult.error.message.includes('budget_incomes')
          ? 'Нужно выполнить SQL-обновление базы данных для версии 1.5.0.'
          : currentResult.error.message,
      )
      return
    }
    if (previousResult.error) {
      setIncomeError(previousResult.error.message)
      return
    }

    setIncomes(currentResult.data || [])
    setPreviousIncomes(previousResult.data || [])
  }

  async function loadExpenses() {
    setLoading(true)
    setError('')

    const ranges = getPeriodRanges(period, customFrom, customTo)
    const currentPromise = buildExpenseQuery(ranges.current)
    const previousPromise = ranges.previous
      ? buildExpenseQuery(ranges.previous)
      : Promise.resolve({ data: [], error: null })

    const [currentResult, previousResult] = await Promise.all([currentPromise, previousPromise])
    setLoading(false)

    if (currentResult.error) {
      setError(currentResult.error.message)
      return
    }
    if (previousResult.error) {
      setError(previousResult.error.message)
      return
    }

    setExpenses(currentResult.data || [])
    setPreviousExpenses(previousResult.data || [])
  }

  function resetExpenseForm() {
    setEditingExpenseId(null)
    setDate(isoDate(new Date()))
    setAmount('')
    setNote('')
    if (managedCategoryNames.length) setCategory(managedCategoryNames[0])
  }

  async function saveExpense(e) {
    e.preventDefault()
    const numericAmount = Number(String(amount).replace(',', '.'))
    if (!date || !category || !numericAmount || numericAmount <= 0) return

    setError('')
    const payload = {
      spent_at: date,
      amount: numericAmount,
      category,
      note: note.trim() || null,
    }

    let saveError = null
    if (editingExpenseId) {
      const { error: updateError } = await supabase
        .from('budget_expenses')
        .update(payload)
        .eq('id', editingExpenseId)
      saveError = updateError
    } else {
      const { error: insertError } = await supabase.from('budget_expenses').insert({
        ...payload,
        user_id: session.user.id,
      })
      saveError = insertError
    }

    if (saveError) {
      setError(saveError.message)
      return
    }

    resetExpenseForm()
    await Promise.all([loadExpenses(), loadMonthlyBudget()])
  }

  function beginEditExpense(item) {
    setEditingExpenseId(item.id)
    setDate(item.spent_at)
    setAmount(String(item.amount).replace('.', ','))
    setCategory(item.category)
    setNote(item.note || '')
    document.querySelector('.expense-editor')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  async function removeExpense(id) {
    if (!window.confirm('Удалить расход?')) return
    const { error: deleteError } = await supabase.from('budget_expenses').delete().eq('id', id)
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    if (editingExpenseId === id) resetExpenseForm()
    await Promise.all([loadExpenses(), loadMonthlyBudget()])
  }

  function resetIncomeForm() {
    setEditingIncomeId(null)
    setIncomeDate(isoDate(new Date()))
    setIncomeAmount('')
    setIncomeNote('')
    if (managedIncomeCategoryNames.length) setIncomeCategory(managedIncomeCategoryNames[0])
  }

  async function saveIncome(e) {
    e.preventDefault()
    const numericAmount = Number(String(incomeAmount).replace(',', '.'))
    if (!incomeDate || !incomeCategory || !numericAmount || numericAmount <= 0) return

    setIncomeError('')
    const payload = {
      received_at: incomeDate,
      amount: numericAmount,
      category: incomeCategory,
      note: incomeNote.trim() || null,
    }

    let saveError = null
    if (editingIncomeId) {
      const { error: updateError } = await supabase
        .from('budget_incomes')
        .update(payload)
        .eq('id', editingIncomeId)
      saveError = updateError
    } else {
      const { error: insertError } = await supabase.from('budget_incomes').insert({
        ...payload,
        user_id: session.user.id,
      })
      saveError = insertError
    }

    if (saveError) {
      setIncomeError(saveError.message)
      return
    }

    resetIncomeForm()
    await Promise.all([loadIncomes(), loadMonthlyBudget()])
  }

  function beginEditIncome(item) {
    setEditingIncomeId(item.id)
    setIncomeDate(item.received_at)
    setIncomeAmount(String(item.amount).replace('.', ','))
    setIncomeCategory(item.category)
    setIncomeNote(item.note || '')
    document.querySelector('.income-editor')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  async function removeIncome(id) {
    if (!window.confirm('Удалить доход?')) return
    const { error: deleteError } = await supabase.from('budget_incomes').delete().eq('id', id)
    if (deleteError) {
      setIncomeError(deleteError.message)
      return
    }
    if (editingIncomeId === id) resetIncomeForm()
    await Promise.all([loadIncomes(), loadMonthlyBudget()])
  }

  async function addCategory(e) {
    e.preventDefault()
    const name = newCategory.trim()
    if (!name) return

    if (categories.some((item) => item.name.toLocaleLowerCase('ru') === name.toLocaleLowerCase('ru'))) {
      setCategoryError('Такая категория уже существует.')
      return
    }

    setCategoryError('')
    const nextOrder = categories.reduce((max, item) => Math.max(max, item.sort_order || 0), -1) + 1
    const { error: insertError } = await supabase.from('budget_categories').insert({
      user_id: session.user.id,
      name,
      sort_order: nextOrder,
    })

    if (insertError) {
      setCategoryError(insertError.message)
      return
    }

    setNewCategory('')
    await loadCategories()
  }

  function beginRenameCategory(item) {
    setEditingCategoryId(item.id)
    setEditingCategoryName(item.name)
    setCategoryError('')
  }

  async function renameCategory(item) {
    const nextName = editingCategoryName.trim()
    if (!nextName || nextName === item.name) {
      setEditingCategoryId(null)
      setEditingCategoryName('')
      return
    }

    if (
      categories.some(
        (categoryItem) =>
          categoryItem.id !== item.id &&
          categoryItem.name.toLocaleLowerCase('ru') === nextName.toLocaleLowerCase('ru'),
      )
    ) {
      setCategoryError('Категория с таким названием уже существует.')
      return
    }

    setCategoryError('')

    const { error: expensesError } = await supabase
      .from('budget_expenses')
      .update({ category: nextName })
      .eq('category', item.name)

    if (expensesError) {
      setCategoryError(expensesError.message)
      return
    }

    const { error: limitsError } = await supabase
      .from('budget_category_limits')
      .update({ category: nextName })
      .eq('category', item.name)

    if (limitsError) {
      await supabase.from('budget_expenses').update({ category: item.name }).eq('category', nextName)
      setCategoryError(limitsError.message)
      return
    }

    const { error: updateError } = await supabase
      .from('budget_categories')
      .update({ name: nextName })
      .eq('id', item.id)

    if (updateError) {
      await supabase.from('budget_expenses').update({ category: item.name }).eq('category', nextName)
      await supabase.from('budget_category_limits').update({ category: item.name }).eq('category', nextName)
      setCategoryError(updateError.message)
      return
    }

    if (category === item.name) setCategory(nextName)
    if (categoryFilter === item.name) setCategoryFilter(nextName)
    setEditingCategoryId(null)
    setEditingCategoryName('')
    await Promise.all([loadCategories(), loadExpenses(), loadMonthlyBudget()])
  }

  async function deleteCategory(item) {
    const message = `Удалить категорию «${item.name}» из списка? Уже записанные расходы сохранятся.`
    if (!window.confirm(message)) return

    setCategoryError('')
    const { error: deleteError } = await supabase.from('budget_categories').delete().eq('id', item.id)
    if (deleteError) {
      setCategoryError(deleteError.message)
      return
    }

    if (category === item.name) {
      const replacement = categories.find((categoryItem) => categoryItem.id !== item.id)
      setCategory(replacement?.name || '')
    }
    setEditingCategoryId(null)
    setEditingCategoryName('')
    await loadCategories()
  }

  async function addIncomeCategory(e) {
    e.preventDefault()
    const name = newIncomeCategory.trim()
    if (!name) return

    if (incomeCategories.some((item) => item.name.toLocaleLowerCase('ru') === name.toLocaleLowerCase('ru'))) {
      setIncomeCategoryError('Такая категория уже существует.')
      return
    }

    setIncomeCategoryError('')
    const nextOrder = incomeCategories.reduce((max, item) => Math.max(max, item.sort_order || 0), -1) + 1
    const { error: insertError } = await supabase.from('budget_income_categories').insert({
      user_id: session.user.id,
      name,
      sort_order: nextOrder,
    })

    if (insertError) {
      setIncomeCategoryError(insertError.message)
      return
    }

    setNewIncomeCategory('')
    await loadIncomeCategories()
  }

  function beginRenameIncomeCategory(item) {
    setEditingIncomeCategoryId(item.id)
    setEditingIncomeCategoryName(item.name)
    setIncomeCategoryError('')
  }

  async function renameIncomeCategory(item) {
    const nextName = editingIncomeCategoryName.trim()
    if (!nextName || nextName === item.name) {
      setEditingIncomeCategoryId(null)
      setEditingIncomeCategoryName('')
      return
    }

    if (
      incomeCategories.some(
        (categoryItem) =>
          categoryItem.id !== item.id &&
          categoryItem.name.toLocaleLowerCase('ru') === nextName.toLocaleLowerCase('ru'),
      )
    ) {
      setIncomeCategoryError('Категория с таким названием уже существует.')
      return
    }

    setIncomeCategoryError('')
    const { error: incomesError } = await supabase
      .from('budget_incomes')
      .update({ category: nextName })
      .eq('category', item.name)

    if (incomesError) {
      setIncomeCategoryError(incomesError.message)
      return
    }

    const { error: updateError } = await supabase
      .from('budget_income_categories')
      .update({ name: nextName })
      .eq('id', item.id)

    if (updateError) {
      await supabase.from('budget_incomes').update({ category: item.name }).eq('category', nextName)
      setIncomeCategoryError(updateError.message)
      return
    }

    if (incomeCategory === item.name) setIncomeCategory(nextName)
    setEditingIncomeCategoryId(null)
    setEditingIncomeCategoryName('')
    await Promise.all([loadIncomeCategories(), loadIncomes(), loadMonthlyBudget()])
  }

  async function deleteIncomeCategory(item) {
    const message = `Удалить категорию дохода «${item.name}» из списка? Уже записанные доходы сохранятся.`
    if (!window.confirm(message)) return

    setIncomeCategoryError('')
    const { error: deleteError } = await supabase.from('budget_income_categories').delete().eq('id', item.id)
    if (deleteError) {
      setIncomeCategoryError(deleteError.message)
      return
    }

    if (incomeCategory === item.name) {
      const replacement = incomeCategories.find((categoryItem) => categoryItem.id !== item.id)
      setIncomeCategory(replacement?.name || '')
    }
    setEditingIncomeCategoryId(null)
    setEditingIncomeCategoryName('')
    await loadIncomeCategories()
  }

  const visibleExpenses = useMemo(() => {
    if (categoryFilter === 'all') return expenses
    return expenses.filter((item) => item.category === categoryFilter)
  }, [expenses, categoryFilter])

  const visiblePreviousExpenses = useMemo(() => {
    if (categoryFilter === 'all') return previousExpenses
    return previousExpenses.filter((item) => item.category === categoryFilter)
  }, [previousExpenses, categoryFilter])

  const sortedExpenses = useMemo(() => {
    const rows = [...visibleExpenses]
    rows.sort((a, b) => {
      if (sortMode === 'date-asc') {
        return a.spent_at.localeCompare(b.spent_at) || String(a.created_at).localeCompare(String(b.created_at))
      }
      if (sortMode === 'amount-desc') {
        return Number(b.amount) - Number(a.amount) || b.spent_at.localeCompare(a.spent_at)
      }
      if (sortMode === 'amount-asc') {
        return Number(a.amount) - Number(b.amount) || b.spent_at.localeCompare(a.spent_at)
      }
      return b.spent_at.localeCompare(a.spent_at) || String(b.created_at).localeCompare(String(a.created_at))
    })
    return rows
  }, [visibleExpenses, sortMode])

  const sortedIncomes = useMemo(() => {
    const rows = [...incomes]
    rows.sort((a, b) => {
      if (incomeSortMode === 'date-asc') {
        return a.received_at.localeCompare(b.received_at) || String(a.created_at).localeCompare(String(b.created_at))
      }
      if (incomeSortMode === 'amount-desc') {
        return Number(b.amount) - Number(a.amount) || b.received_at.localeCompare(a.received_at)
      }
      if (incomeSortMode === 'amount-asc') {
        return Number(a.amount) - Number(b.amount) || b.received_at.localeCompare(a.received_at)
      }
      return b.received_at.localeCompare(a.received_at) || String(b.created_at).localeCompare(String(a.created_at))
    })
    return rows
  }, [incomes, incomeSortMode])

  const cashflowStats = useMemo(() => {
    const incomeTotal = incomes.reduce((sum, item) => sum + Number(item.amount), 0)
    const expenseTotal = expenses.reduce((sum, item) => sum + Number(item.amount), 0)
    const balance = incomeTotal - expenseTotal
    const savingsRate = incomeTotal > 0 ? (balance / incomeTotal) * 100 : null

    const previousIncomeTotal = previousIncomes.reduce((sum, item) => sum + Number(item.amount), 0)
    const previousExpenseTotal = previousExpenses.reduce((sum, item) => sum + Number(item.amount), 0)
    const previousBalance = previousIncomeTotal - previousExpenseTotal
    const comparisonUnavailable = period === 'all' || (period === 'custom' && (!customFrom || !customTo))
    const balanceChange = comparisonUnavailable ? null : balance - previousBalance
    const incomeChange = comparisonUnavailable ? null : incomeTotal - previousIncomeTotal
    const incomeChangePercent = comparisonUnavailable
      ? null
      : previousIncomeTotal === 0
        ? (incomeTotal > 0 ? Infinity : 0)
        : ((incomeTotal - previousIncomeTotal) / previousIncomeTotal) * 100

    return {
      incomeTotal,
      expenseTotal,
      balance,
      savingsRate,
      previousIncomeTotal,
      previousExpenseTotal,
      previousBalance,
      balanceChange,
      incomeChange,
      incomeChangePercent,
    }
  }, [incomes, expenses, previousIncomes, previousExpenses, period, customFrom, customTo])

  const stats = useMemo(() => {
    const total = visibleExpenses.reduce((sum, item) => sum + Number(item.amount), 0)
    const previousTotal = visiblePreviousExpenses.reduce((sum, item) => sum + Number(item.amount), 0)
    const byCategory = new Map()

    for (const item of visibleExpenses) {
      byCategory.set(item.category, (byCategory.get(item.category) || 0) + Number(item.amount))
    }

    const categoriesStats = [...byCategory.entries()]
      .map(([name, value]) => ({
        name,
        value,
        share: total ? (value / total) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value)

    let changePercent = null
    if (period !== 'all' && !(period === 'custom' && (!customFrom || !customTo))) {
      if (previousTotal > 0) changePercent = ((total - previousTotal) / previousTotal) * 100
      else if (total > 0) changePercent = Infinity
      else changePercent = 0
    }

    const ranges = getPeriodRanges(period, customFrom, customTo)
    let dayCount = inclusiveDays(ranges.current?.from, ranges.current?.to)
    if (period === 'all') {
      const datedRows = expenses.filter((item) => item.spent_at)
      const earliest = datedRows.length
        ? datedRows.reduce((min, item) => item.spent_at < min ? item.spent_at : min, datedRows[0].spent_at)
        : null
      dayCount = earliest ? inclusiveDays(earliest, isoDate(new Date())) : null
    }

    const averagePerDay = dayCount && dayCount > 0 ? total / dayCount : 0
    const largestExpense = visibleExpenses.reduce(
      (largest, item) => !largest || Number(item.amount) > Number(largest.amount) ? item : largest,
      null,
    )

    return {
      total,
      previousTotal,
      changePercent,
      count: visibleExpenses.length,
      categories: categoriesStats,
      averagePerDay,
      dayCount,
      largestExpense,
    }
  }, [visibleExpenses, visiblePreviousExpenses, expenses, period, customFrom, customTo])

  const budgetStats = useMemo(() => {
    const spentTotal = monthExpenses.reduce((sum, item) => sum + Number(item.amount), 0)
    const incomeTotal = monthIncomes.reduce((sum, item) => sum + Number(item.amount), 0)
    const netBalance = incomeTotal - spentTotal
    const totalLimit = Number(monthlyBudget?.total_limit || 0)
    const remaining = totalLimit ? totalLimit - spentTotal : null
    const overallPercent = totalLimit ? (spentTotal / totalLimit) * 100 : null

    const spentByCategory = new Map()
    for (const item of monthExpenses) {
      spentByCategory.set(item.category, (spentByCategory.get(item.category) || 0) + Number(item.amount))
    }
    const limitByCategory = new Map(
      categoryLimits.map((item) => [item.category, Number(item.limit_amount)]),
    )

    const names = new Set([
      ...managedCategoryNames,
      ...spentByCategory.keys(),
      ...limitByCategory.keys(),
    ])

    const rows = [...names]
      .map((name) => {
        const spent = spentByCategory.get(name) || 0
        const limit = limitByCategory.get(name) || 0
        return {
          name,
          spent,
          limit,
          remaining: limit ? limit - spent : null,
          percent: limit ? (spent / limit) * 100 : null,
        }
      })
      .filter((item) => item.spent > 0 || item.limit > 0)
      .sort((a, b) => {
        if (a.limit && !b.limit) return -1
        if (!a.limit && b.limit) return 1
        return b.spent - a.spent || a.name.localeCompare(b.name, 'ru')
      })

    return { spentTotal, incomeTotal, netBalance, totalLimit, remaining, overallPercent, rows }
  }, [monthExpenses, monthIncomes, monthlyBudget, categoryLimits, managedCategoryNames])

  function budgetStatus(percent) {
    if (percent === null) return 'budget-neutral'
    if (percent >= 100) return 'budget-danger'
    if (percent >= 80) return 'budget-warning'
    return 'budget-good'
  }

  const donutSegments = useMemo(() => {
    let offset = 0
    return stats.categories.map((item, index) => {
      const segment = {
        ...item,
        color: CHART_COLORS[index % CHART_COLORS.length],
        offset,
      }
      offset += item.share
      return segment
    })
  }, [stats.categories])

  const comparisonText = useMemo(() => {
    if (stats.changePercent === null) return '—'
    if (stats.changePercent === Infinity) return 'Новый расход'
    const sign = stats.changePercent > 0 ? '+' : ''
    return `${sign}${stats.changePercent.toFixed(1)}%`
  }, [stats.changePercent])

  const comparisonClass = stats.changePercent === null || stats.changePercent === 0
    ? 'neutral'
    : stats.changePercent > 0
      ? 'increase'
      : 'decrease'

  const incomeComparisonText = cashflowStats.incomeChangePercent === null
    ? '—'
    : cashflowStats.incomeChangePercent === Infinity
      ? 'Новый доход'
      : `${cashflowStats.incomeChangePercent > 0 ? '+' : ''}${cashflowStats.incomeChangePercent.toFixed(1)}%`

  const incomeComparisonClass = cashflowStats.incomeChange === null || cashflowStats.incomeChange === 0
    ? 'neutral'
    : cashflowStats.incomeChange > 0
      ? 'cashflow-positive'
      : 'cashflow-negative'

  if (loadingSession) return <div className="center">Загрузка…</div>
  if (!session) return <Login onReady={() => window.location.reload()} />

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>Мой бюджет</h1>
          <div className="muted small">Версия 1.5.1</div>
        </div>
        <button className="secondary compact" onClick={() => supabase.auth.signOut()}>
          Выйти
        </button>
      </header>

      <section className="card filters-card">
        <div className="field">
          <label>Период</label>
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            {PERIODS.map(([value, label]) => (
              <option value={value} key={value}>{label}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Категория</label>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="all">Все категории</option>
            {allCategoryNames.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>

        {period === 'custom' && (
          <>
            <div className="field">
              <label>С</label>
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            </div>
            <div className="field">
              <label>По</label>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </div>
          </>
        )}
      </section>

      <section className="card cashflow-section">
        <div className="cashflow-head">
          <div>
            <div className="section-title cashflow-title">Баланс периода</div>
            <div className="muted tiny">Доходы и расходы по всем категориям за выбранный период</div>
          </div>
          {cashflowStats.balanceChange !== null && (
            <div className="cashflow-dynamics">
              <div className={`cashflow-change ${cashflowStats.balanceChange >= 0 ? 'cashflow-positive' : 'cashflow-negative'}`}>
                <span className="muted tiny">Изменение баланса к предыдущему периоду</span>
                <strong>{cashflowStats.balanceChange >= 0 ? '+' : ''}{formatMoney(cashflowStats.balanceChange)}</strong>
                <div className="muted tiny">Было: {formatMoney(cashflowStats.previousBalance)}</div>
              </div>
              <div className={`cashflow-change ${incomeComparisonClass}`}>
                <span className="muted tiny">Динамика доходов</span>
                <strong>{incomeComparisonText}</strong>
                <div className="muted tiny comparison-values">
                  {formatMoney(cashflowStats.incomeTotal)} · было {formatMoney(cashflowStats.previousIncomeTotal)}
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="cashflow-grid">
          <div className="cashflow-card income-tone">
            <span className="muted">Доходы</span>
            <strong>{formatMoney(cashflowStats.incomeTotal)}</strong>
          </div>
          <div className="cashflow-card expense-tone">
            <span className="muted">Расходы</span>
            <strong>{formatMoney(cashflowStats.expenseTotal)}</strong>
          </div>
          <div className={`cashflow-card ${cashflowStats.balance >= 0 ? 'balance-positive' : 'balance-negative'}`}>
            <span className="muted">Баланс</span>
            <strong>{formatMoney(cashflowStats.balance)}</strong>
          </div>
          <div className="cashflow-card">
            <span className="muted">Доля сбережений</span>
            <strong>
              {cashflowStats.savingsRate === null ? '—' : `${cashflowStats.savingsRate.toFixed(1)}%`}
            </strong>
            <div className="muted tiny">Баланс / доходы</div>
          </div>
        </div>
      </section>

      <section className="summary-grid summary-grid-five">
        <div className="card stat-card">
          <span className="muted">Расходы</span>
          <strong>{formatMoney(stats.total)}</strong>
        </div>
        <div className="card stat-card">
          <span className="muted">Записей</span>
          <strong>{stats.count}</strong>
        </div>
        <div className="card stat-card">
          <span className="muted">Средний расход в день</span>
          <strong>{formatMoney(stats.averagePerDay)}</strong>
          {stats.dayCount && <div className="muted tiny">За {stats.dayCount} дн.</div>}
        </div>
        <div className="card stat-card">
          <span className="muted">Самая большая трата</span>
          <strong>{formatMoney(stats.largestExpense?.amount || 0)}</strong>
          {stats.largestExpense && (
            <div className="muted tiny">
              {stats.largestExpense.category} · {formatDate(stats.largestExpense.spent_at)}
            </div>
          )}
        </div>
        <div className="card stat-card comparison-card">
          <span className="muted">Динамика расходов</span>
          <strong className={comparisonClass}>{comparisonText}</strong>
          {stats.changePercent !== null && (
            <div className="muted tiny comparison-values">
              Текущий: {formatMoney(stats.total)} · Предыдущий: {formatMoney(stats.previousTotal)}
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <div className="section-title">По категориям</div>
        {stats.categories.length === 0 ? (
          <div className="empty">За выбранный период расходов нет.</div>
        ) : (
          <div className="analytics-layout">
            <div className="donut-wrap">
              <div className="donut-chart" aria-label="Диаграмма расходов по категориям">
                <svg className="donut-svg" viewBox="0 0 120 120" role="img">
                  <circle className="donut-track" cx="60" cy="60" r="45" />
                  {donutSegments.map((item) => (
                    <circle
                      key={item.name}
                      className="donut-segment"
                      cx="60"
                      cy="60"
                      r="45"
                      pathLength="100"
                      style={{
                        stroke: item.color,
                        strokeDasharray: `${item.share} ${100 - item.share}`,
                        strokeDashoffset: -item.offset,
                      }}
                      onClick={() => setCategoryFilter(item.name)}
                    >
                      <title>{`${item.name}: ${formatMoney(item.value)} (${item.share.toFixed(1)}%)`}</title>
                    </circle>
                  ))}
                </svg>
                <div className="donut-hole">
                  <span className="muted tiny">Всего</span>
                  <strong>{formatMoney(stats.total)}</strong>
                </div>
              </div>
              <div className="muted tiny chart-hint">Нажми на сектор или категорию для фильтрации</div>
            </div>

            <div className="category-stats">
              {donutSegments.map((item) => (
                <button
                  type="button"
                  className={`category-row category-row-button ${categoryFilter === item.name ? 'active-category' : ''}`}
                  key={item.name}
                  onClick={() => setCategoryFilter(item.name)}
                >
                  <div className="category-row-head">
                    <span className="category-name-with-dot">
                      <span className="legend-dot" style={{ background: item.color }} />
                      {item.name}
                    </span>
                    <strong>{formatMoney(item.value)}</strong>
                  </div>
                  <div className="bar-bg">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${Math.max(item.share, 2)}%`,
                        background: item.color,
                      }}
                    />
                  </div>
                  <div className="muted tiny">{item.share.toFixed(1)}%</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="card budget-section">
        <div className="budget-section-head">
          <div>
            <div className="section-title budget-title">Бюджет месяца</div>
            <div className="muted small">{formatMonth(budgetMonth)}</div>
          </div>
          <div className="budget-month-picker">
            <label htmlFor="budget-month">Месяц</label>
            <input
              id="budget-month"
              type="month"
              value={budgetMonth}
              onChange={(e) => setBudgetMonth(e.target.value)}
            />
          </div>
        </div>

        {budgetError && <div className="error">{budgetError}</div>}

        {budgetLoading ? (
          <div className="empty">Загрузка бюджета…</div>
        ) : (
          <>
            <div className="budget-overview budget-overview-five">
              <div className="budget-overview-item income-tone">
                <span className="muted">Доходы месяца</span>
                <strong>{formatMoney(budgetStats.incomeTotal)}</strong>
              </div>
              <div className="budget-overview-item">
                <span className="muted">Потрачено</span>
                <strong>{formatMoney(budgetStats.spentTotal)}</strong>
              </div>
              <div className={`budget-overview-item ${budgetStats.netBalance >= 0 ? 'balance-positive' : 'balance-negative'}`}>
                <span className="muted">Баланс месяца</span>
                <strong>{formatMoney(budgetStats.netBalance)}</strong>
              </div>
              <div className="budget-overview-item">
                <span className="muted">Общий лимит</span>
                <strong>{budgetStats.totalLimit ? formatMoney(budgetStats.totalLimit) : 'Не задан'}</strong>
              </div>
              <div className={`budget-overview-item ${budgetStatus(budgetStats.overallPercent)}`}>
                <span className="muted">{budgetStats.remaining !== null && budgetStats.remaining < 0 ? 'Превышение' : 'Осталось'}</span>
                <strong>
                  {budgetStats.remaining === null
                    ? '—'
                    : formatMoney(Math.abs(budgetStats.remaining))}
                </strong>
              </div>
            </div>

            {budgetStats.totalLimit > 0 && (
              <div className="budget-total-progress">
                <div className="budget-progress-head">
                  <span>{Math.round(budgetStats.overallPercent)}% общего лимита</span>
                  {budgetStats.overallPercent >= 100 ? (
                    <strong className="budget-danger-text">Лимит превышен</strong>
                  ) : budgetStats.overallPercent >= 80 ? (
                    <strong className="budget-warning-text">Лимит близко</strong>
                  ) : null}
                </div>
                <div className="budget-progress-track">
                  <div
                    className={`budget-progress-fill ${budgetStatus(budgetStats.overallPercent)}`}
                    style={{ width: `${Math.min(budgetStats.overallPercent, 100)}%` }}
                  />
                </div>
              </div>
            )}

            <div className="budget-category-list">
              {budgetStats.rows.length === 0 ? (
                <div className="empty">Лимиты по категориям ещё не заданы.</div>
              ) : (
                budgetStats.rows.map((item) => (
                  <div className="budget-category-row" key={item.name}>
                    <div className="budget-category-head">
                      <strong>{item.name}</strong>
                      <span>
                        {formatMoney(item.spent)}
                        {item.limit > 0 ? ` / ${formatMoney(item.limit)}` : ' / без лимита'}
                      </span>
                    </div>
                    {item.limit > 0 ? (
                      <>
                        <div className="budget-progress-track">
                          <div
                            className={`budget-progress-fill ${budgetStatus(item.percent)}`}
                            style={{ width: `${Math.min(item.percent, 100)}%` }}
                          />
                        </div>
                        <div className="budget-category-foot">
                          <span className="muted tiny">{item.percent.toFixed(0)}% лимита</span>
                          <span className={`tiny ${item.remaining < 0 ? 'budget-danger-text' : 'muted'}`}>
                            {item.remaining < 0
                              ? `Превышение: ${formatMoney(Math.abs(item.remaining))}`
                              : `Осталось: ${formatMoney(item.remaining)}`}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="muted tiny">Для этой категории лимит не задан.</div>
                    )}
                  </div>
                ))
              )}
            </div>

            <details className="budget-settings-details">
              <summary>Настроить бюджет на {formatMonth(budgetMonth).toLocaleLowerCase('ru')}</summary>
              <form className="budget-settings-form" onSubmit={saveMonthlyBudget}>
                <div className="budget-total-input">
                  <label>Общий месячный лимит, €</label>
                  <input
                    inputMode="decimal"
                    placeholder="Например, 1200"
                    value={totalBudgetInput}
                    onChange={(e) => setTotalBudgetInput(e.target.value)}
                  />
                </div>

                <div className="budget-limit-grid">
                  {managedCategoryNames.map((name) => (
                    <label className="budget-limit-field" key={name}>
                      <span>{name}</span>
                      <input
                        inputMode="decimal"
                        placeholder="Без лимита"
                        value={categoryLimitInputs[name] || ''}
                        onChange={(e) => setCategoryLimitInputs((current) => ({
                          ...current,
                          [name]: e.target.value,
                        }))}
                      />
                    </label>
                  ))}
                </div>

                <div className="budget-settings-actions">
                  <button className="primary" disabled={budgetSaving}>
                    {budgetSaving ? 'Сохранение…' : 'Сохранить лимиты'}
                  </button>
                  <span className="muted tiny">Пустое поле означает, что лимит не задан.</span>
                </div>
              </form>
            </details>
          </>
        )}
      </section>

      <section className={`card income-editor ${editingIncomeId ? 'editing-card income-editing-card' : ''}`}>
        <div className="section-title">
          {editingIncomeId ? 'Редактировать доход' : 'Добавить доход'}
        </div>
        <form className="expense-form" onSubmit={saveIncome}>
          <div className="field">
            <label>Дата</label>
            <input type="date" value={incomeDate} onChange={(e) => setIncomeDate(e.target.value)} required />
          </div>
          <div className="field">
            <label>Сумма, €</label>
            <input
              inputMode="decimal"
              placeholder="0,00"
              value={incomeAmount}
              onChange={(e) => setIncomeAmount(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Категория дохода</label>
            <select value={incomeCategory} onChange={(e) => setIncomeCategory(e.target.value)} required>
              {managedIncomeCategoryNames.map((item) => <option key={item}>{item}</option>)}
              {!managedIncomeCategoryNames.includes(incomeCategory) && incomeCategory && <option>{incomeCategory}</option>}
            </select>
          </div>
          <div className="field grow">
            <label>Описание</label>
            <input
              placeholder="Необязательно"
              value={incomeNote}
              onChange={(e) => setIncomeNote(e.target.value)}
            />
          </div>
          <button className="primary income-primary add-button">
            {editingIncomeId ? 'Сохранить' : 'Добавить доход'}
          </button>
          {editingIncomeId && (
            <button type="button" className="secondary add-button" onClick={resetIncomeForm}>
              Отмена
            </button>
          )}
        </form>
        {incomeError && <div className="error">{incomeError}</div>}
      </section>

      <section className="card">
        <details className="categories-details">
          <summary>Управление категориями доходов</summary>
          <div className="categories-body">
            <form className="category-add-form" onSubmit={addIncomeCategory}>
              <input
                placeholder="Новая категория дохода"
                value={newIncomeCategory}
                onChange={(e) => setNewIncomeCategory(e.target.value)}
              />
              <button className="primary income-primary compact">Добавить</button>
            </form>

            {incomeCategoryError && <div className="error">{incomeCategoryError}</div>}

            <div className="category-manage-list">
              {incomeCategories.map((item) => (
                <div className="category-manage-item" key={item.id}>
                  {editingIncomeCategoryId === item.id ? (
                    <>
                      <input
                        value={editingIncomeCategoryName}
                        onChange={(e) => setEditingIncomeCategoryName(e.target.value)}
                        autoFocus
                      />
                      <div className="row-actions">
                        <button type="button" className="primary income-primary compact" onClick={() => renameIncomeCategory(item)}>
                          Сохранить
                        </button>
                        <button
                          type="button"
                          className="secondary compact"
                          onClick={() => {
                            setEditingIncomeCategoryId(null)
                            setEditingIncomeCategoryName('')
                          }}
                        >
                          Отмена
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span>{item.name}</span>
                      <div className="row-actions">
                        <button type="button" className="secondary compact" onClick={() => beginRenameIncomeCategory(item)}>
                          Изменить
                        </button>
                        <button type="button" className="danger compact" onClick={() => deleteIncomeCategory(item)}>
                          Удалить
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </details>
      </section>

      <section className="card">
        <div className="list-header">
          <div className="section-title list-title">Доходы</div>
          <div className="sort-control">
            <label htmlFor="income-sort">Сортировка</label>
            <select id="income-sort" value={incomeSortMode} onChange={(e) => setIncomeSortMode(e.target.value)}>
              {SORT_OPTIONS.map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {incomeError && <div className="error">{incomeError}</div>}
        {sortedIncomes.length === 0 ? (
          <div className="empty">Нет доходов за выбранный период.</div>
        ) : (
          <div className="expense-list">
            {sortedIncomes.map((item) => (
              <div className="expense-item income-item" key={item.id}>
                <div className="expense-main">
                  <div className="expense-topline">
                    <strong>{item.category}</strong>
                    <strong className="income-amount">+{formatMoney(item.amount)}</strong>
                  </div>
                  <div className="muted small expense-meta">
                    <span>{formatDate(item.received_at)}</span>
                    {item.note && <><span className="meta-separator">·</span><span>{item.note}</span></>}
                  </div>
                </div>
                <div className="row-actions expense-actions">
                  <button className="secondary compact" onClick={() => beginEditIncome(item)}>
                    Изменить
                  </button>
                  <button className="danger compact" onClick={() => removeIncome(item.id)}>
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={`card expense-editor ${editingExpenseId ? 'editing-card' : ''}`}>
        <div className="section-title">
          {editingExpenseId ? 'Редактировать расход' : 'Добавить расход'}
        </div>
        <form className="expense-form" onSubmit={saveExpense}>
          <div className="field">
            <label>Дата</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="field">
            <label>Сумма, €</label>
            <input
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Категория</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} required>
              {managedCategoryNames.map((item) => <option key={item}>{item}</option>)}
              {!managedCategoryNames.includes(category) && category && <option>{category}</option>}
            </select>
          </div>
          <div className="field grow">
            <label>Описание</label>
            <input
              placeholder="Необязательно"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <button className="primary add-button">
            {editingExpenseId ? 'Сохранить' : 'Добавить'}
          </button>
          {editingExpenseId && (
            <button type="button" className="secondary add-button" onClick={resetExpenseForm}>
              Отмена
            </button>
          )}
        </form>
        {error && <div className="error">{error}</div>}
      </section>

      <section className="card">
        <details className="categories-details">
          <summary>Управление категориями</summary>
          <div className="categories-body">
            <form className="category-add-form" onSubmit={addCategory}>
              <input
                placeholder="Новая категория"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              />
              <button className="primary compact">Добавить</button>
            </form>

            {categoryError && <div className="error">{categoryError}</div>}

            <div className="category-manage-list">
              {categories.map((item) => (
                <div className="category-manage-item" key={item.id}>
                  {editingCategoryId === item.id ? (
                    <>
                      <input
                        value={editingCategoryName}
                        onChange={(e) => setEditingCategoryName(e.target.value)}
                        autoFocus
                      />
                      <div className="row-actions">
                        <button type="button" className="primary compact" onClick={() => renameCategory(item)}>
                          Сохранить
                        </button>
                        <button
                          type="button"
                          className="secondary compact"
                          onClick={() => {
                            setEditingCategoryId(null)
                            setEditingCategoryName('')
                          }}
                        >
                          Отмена
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span>{item.name}</span>
                      <div className="row-actions">
                        <button type="button" className="secondary compact" onClick={() => beginRenameCategory(item)}>
                          Изменить
                        </button>
                        <button type="button" className="danger compact" onClick={() => deleteCategory(item)}>
                          Удалить
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </details>
      </section>

      <section className="card">
        <div className="list-header">
          <div className="section-title list-title">Расходы</div>
          <div className="sort-control">
            <label htmlFor="expense-sort">Сортировка</label>
            <select id="expense-sort" value={sortMode} onChange={(e) => setSortMode(e.target.value)}>
              {SORT_OPTIONS.map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="empty">Загрузка…</div>
        ) : sortedExpenses.length === 0 ? (
          <div className="empty">Нет записей.</div>
        ) : (
          <div className="expense-list">
            {sortedExpenses.map((item) => (
              <div className="expense-item" key={item.id}>
                <div className="expense-main">
                  <div className="expense-topline">
                    <strong>{item.category}</strong>
                    <strong>{formatMoney(item.amount)}</strong>
                  </div>
                  <div className="muted small expense-meta">
                    <span>{formatDate(item.spent_at)}</span>
                    {item.note && <><span className="meta-separator">·</span><span>{item.note}</span></>}
                  </div>
                </div>
                <div className="row-actions expense-actions">
                  <button className="secondary compact" onClick={() => beginEditExpense(item)}>
                    Изменить
                  </button>
                  <button className="danger compact" onClick={() => removeExpense(item.id)}>
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
