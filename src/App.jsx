import { useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  CircleHelp,
  FileText,
  Globe2,
  MessageCircle,
  ShieldCheck,
} from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_URL || ''
const passageIds = /\[([0-9a-f-]{36}(?:\s*,\s*[0-9a-f-]{36})*)\]/gi

function passageUrl(citation) {
  if (!citation?.sourceUrl) return ''
  const base = `${API_BASE}${citation.sourceUrl}`
  const documentId = citation.sourceUrl.match(/\/api\/documents\/([0-9a-f-]{36})\/source/i)?.[1]
  return citation.contentType === 'application/pdf' && documentId && citation.page > 0
    ? `/source/${documentId}?passage=${encodeURIComponent(citation.id)}${citation.quote ? `&quote=${encodeURIComponent(citation.quote)}` : ''}` : base
}

function quotedWords(words, quote) {
  const tokenize = (value) => value.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []
  const target = tokenize(quote)
  if (!target.length) return words
  const tokens = words.flatMap((word, index) => tokenize(word.text).map((text) => ({ text, index })))
  for (let start = 0; start + target.length <= tokens.length; start += 1) {
    if (target.every((text, offset) => tokens[start + offset].text === text)) {
      return words.slice(tokens[start].index, tokens[start + target.length - 1].index + 1)
    }
  }
  return words
}

function PDFSourcePage() {
  const documentId = window.location.pathname.split('/')[2]
  const passageId = new URLSearchParams(window.location.search).get('passage')
  const quote = new URLSearchParams(window.location.search).get('quote') || ''
  const canvasRef = useRef(null)
  const pageRef = useRef(null)
  const [pdfPage, setPdfPage] = useState(null)
  const [passage, setPassage] = useState(null)
  const [state, setState] = useState('loading')
  const [scaleWidth, setScaleWidth] = useState(900)
  const [pageSize, setPageSize] = useState(null)

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setScaleWidth(Math.min(entry.contentRect.width, 900)))
    if (pageRef.current) observer.observe(pageRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (state !== 'ready') return undefined
    const frame = window.requestAnimationFrame(() => document.querySelector('.pdf-highlight')?.scrollIntoView({ block: 'center' }))
    return () => window.cancelAnimationFrame(frame)
  }, [state, passageId])

  useEffect(() => {
    let active = true
    let loadingTask = null
    async function load() {
      try {
        if (!passageId) throw new Error('No passage selected.')
        setState('loading')
        const response = await fetch(`${API_BASE}/api/passages/${encodeURIComponent(passageId)}/position`)
        if (!response.ok) throw new Error('This passage is unavailable.')
        const position = await response.json()
        if (position.documentId.toLowerCase() !== documentId.toLowerCase() || !position.words?.length) throw new Error('This passage has no PDF position.')
        if (!active) return
        setPassage(position)
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
        loadingTask = pdfjs.getDocument({ url: `${API_BASE}/api/documents/${documentId}/source` })
        const document = await loadingTask.promise
        if (!active) return
        const page = await document.getPage(position.page)
        if (active) setPdfPage(page)
      } catch { if (active) setState('error') }
    }
    load()
    return () => { active = false; if (loadingTask) loadingTask.destroy() }
  }, [documentId, passageId])

  useEffect(() => {
    if (!pdfPage) return undefined
    let active = true
    let renderTask = null
    async function render() {
      try {
        setState('loading')
        const viewport = pdfPage.getViewport({ scale: scaleWidth / pdfPage.getViewport({ scale: 1 }).width })
        const ratio = Math.min(window.devicePixelRatio || 1, 2)
        const offscreen = document.createElement('canvas')
        offscreen.width = Math.floor(viewport.width * ratio)
        offscreen.height = Math.floor(viewport.height * ratio)
        renderTask = pdfPage.render({ canvasContext: offscreen.getContext('2d'), canvas: offscreen, viewport, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0] })
        await renderTask.promise
        if (!active || !canvasRef.current) return
        const canvas = canvasRef.current
        canvas.width = offscreen.width
        canvas.height = offscreen.height
        canvas.style.width = `${viewport.width}px`
        canvas.style.height = `${viewport.height}px`
        canvas.getContext('2d').drawImage(offscreen, 0, 0)
        setPageSize({ width: viewport.width, height: viewport.height })
        setState('ready')
      } catch (error) { if (active && error?.name !== 'RenderingCancelledException') setState('error') }
    }
    render()
    return () => { active = false; if (renderTask) renderTask.cancel() }
  }, [pdfPage, scaleWidth])

  const lines = new Map()
  for (const word of quotedWords(passage?.words || [], quote)) {
    const previous = lines.get(word.line)
    if (previous) {
      previous.x0 = Math.min(previous.x0, word.box.x0)
      previous.y0 = Math.min(previous.y0, word.box.y0)
      previous.x1 = Math.max(previous.x1, word.box.x1)
      previous.y1 = Math.max(previous.y1, word.box.y1)
    } else lines.set(word.line, { ...word.box })
  }
  const highlightLines = [...lines.values()]
  const firstLine = highlightLines[0]

  return <div className="pdf-source-page">
    <header className="pdf-source-header"><Brand inverse flag /><div><a href="/chat"><ArrowLeft size={16} /> Back to chat</a><a href={`${API_BASE}/api/documents/${documentId}/source#page=${passage?.page || 1}`} target="_blank" rel="noreferrer">Open original PDF <ArrowUp size={15} /></a></div></header>
    <main className="pdf-source-main">
      <div className="pdf-source-intro"><div className="pdf-source-intro-copy"><span>DOCUMENT SOURCE</span><h1>Read the passage in context.</h1><p>The highlighted text comes directly from the cited document.</p></div><div className="pdf-source-intro-note"><span>CITED PASSAGE</span><strong>Page {passage?.page || '—'} · lines {passage ? `${passage.startLine}–${passage.endLine}` : '—'}</strong><p>Follow the answer back to the exact words in the source.</p></div></div>
      {state === 'error' && <div className="pdf-source-error">This passage could not be loaded. The document may have been updated.</div>}
      <div className="pdf-source-layout">
        <div className="pdf-page-area" ref={pageRef}>
          <div className="pdf-page-toolbar"><span>DOCUMENT VIEW</span><span>{passage?.page ? `Page ${passage.page}` : 'Loading page'}</span></div>
          {state === 'loading' && <p className="pdf-loading">Loading page {passage?.page || ''}…</p>}
          <div className={`pdf-page ${state === 'ready' ? 'is-ready' : ''}`} style={pageSize ? { width: pageSize.width, height: pageSize.height } : {}}>
            <canvas ref={canvasRef} aria-label={`PDF page ${passage?.page || ''}`} />
            {state === 'ready' && highlightLines.map((box, index) => <span key={index} className="pdf-highlight" style={{ left: `${100 * box.x0 / passage.pageWidth}%`, top: `${100 * box.y0 / passage.pageHeight}%`, width: `${100 * (box.x1 - box.x0) / passage.pageWidth}%`, height: `${100 * (box.y1 - box.y0) / passage.pageHeight}%` }} />)}
            {state === 'ready' && firstLine && <span className="pdf-highlight-pin" style={{ left: `${100 * firstLine.x0 / passage.pageWidth}%`, top: `${100 * firstLine.y0 / passage.pageHeight}%` }} />}
          </div>
        </div>
        {passage && <aside className="pdf-source-aside"><span>PAGE {passage.page} · LINES {passage.startLine}–{passage.endLine}</span><h2>{passage.section || 'Cited passage'}</h2>{quote && <blockquote>{quote}</blockquote>}<p>{passage.content}</p></aside>}
      </div>
    </main>
  </div>
}

function AnswerMarkdown({ text, citations }) {
  const byId = new Map(citations.map((citation, index) => [citation.id.toLowerCase(), { citation, number: index + 1 }]))
  const linked = new Set(citations.map(passageUrl).filter(Boolean))
  let markdown = text.replace(passageIds, (_, ids) => ids.split(/\s*,\s*/).map((id) => {
    const match = byId.get(id.toLowerCase())
    const url = match && passageUrl(match.citation)
    return url ? `[${match.number}](${url})` : ''
  }).filter(Boolean).join(' '))
  const hasInlineReference = citations.some((citation, index) => markdown.includes(`[${index + 1}](${passageUrl(citation)})`))
  if (!hasInlineReference && citations.length) markdown += `\n\n${citations.map((citation, index) => `[${index + 1}](${passageUrl(citation)})`).join(' ')}`

  return <div className="answer-markdown"><ReactMarkdown components={{ a: ({ href, children }) => linked.has(href) ? <a className="inline-citation" href={href} target="_blank" rel="noreferrer" aria-label={`Open source ${children} in the document`}>{children}</a> : <span>{children}</span>, img: () => null }}>{markdown}</ReactMarkdown></div>
}

function SourceCards({ citations }) {
  const groups = new Map()
  citations.forEach((citation, index) => {
    const key = citation.sourceUrl || citation.title
    if (!groups.has(key)) groups.set(key, { title: citation.title, passages: [] })
    const group = groups.get(key)
    const destination = passageUrl(citation)
    const existing = group.passages.find((passage) => passage.destination === destination && passage.section === citation.section)
    if (existing) existing.numbers.push(index + 1)
    else group.passages.push({ destination, section: citation.section, page: citation.page, numbers: [index + 1], excerpt: citation.excerpt })
  })

  return <div className="citations"><span>SOURCES</span>{[...groups].map(([key, group]) => <div className="source-card" key={key}><div className="source-card-heading"><FileText size={18} /><strong>{group.title}</strong></div><div className="source-passages">{group.passages.map((passage) => {
    const label = `${passage.section || 'Passage'}${passage.page > 0 ? ` · page ${passage.page}` : ''}`
    return passage.destination ? <a key={`${passage.destination}-${passage.section}`} href={passage.destination} target="_blank" rel="noreferrer" title={passage.excerpt}><span className="source-number">{passage.numbers.join(', ')}</span><span>{label}</span><ArrowUp size={14} /></a> : <span key={label}>{label}</span>
  })}</div></div>)}</div>
}

const promptIdeas = [
  'What does the Constitution say about my rights?',
  'What does each level of government do?',
  'Where can I find the rules for voting?',
]

const heroSlides = [
  { image: '/hero-road.jpg', preview: 'Who maintains local roads?', question: 'Who is responsible for maintaining local roads?' },
  { image: '/hero-mangrove.jpg', preview: 'Who protects our environment?', question: 'What does the Constitution say about protecting the environment?' },
  { image: '/hero-park.jpg', preview: 'What rights do I have?', question: 'What rights does the Constitution protect?' },
  { image: '/hero-river.jpg', preview: 'How is government power shared?', question: 'How are federal, state and local government powers divided?' },
  { image: '/hero-water.jpg', preview: 'Who provides local services?', question: 'What does local government do for basic services?' },
  { image: '/hero-square.jpg', preview: 'How does voting work?', question: 'What are the rules for voting in Nigeria?' },
]

function Brand({ inverse = false, flag = false }) {
  return (
    <a className={`brand ${inverse ? 'brand-inverse' : ''}`} href="/" aria-label="Citizen.ng home">
      {flag && <span className="nigeria-flag" aria-hidden="true" />}
      citizen.ng
    </a>
  )
}

function LandingPage() {
  const [question, setQuestion] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [slideIndex, setSlideIndex] = useState(0)
  const [slidePaused, setSlidePaused] = useState(false)
  const activeSlide = heroSlides[slideIndex]
  const examples = [
    'What does the Constitution say about my rights?',
    'What can the police ask me to do?',
    'What does a local government handle?',
  ]

  useEffect(() => {
    if (slidePaused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const timer = window.setInterval(() => setSlideIndex((current) => (current + 1) % heroSlides.length), 7000)
    return () => window.clearInterval(timer)
  }, [slidePaused])

  function askCitizen(value = question) {
    const trimmed = value.trim()
    window.location.href = trimmed ? `/chat?q=${encodeURIComponent(trimmed)}` : '/chat'
  }

  return (
    <div className="citizen-home">
      <div className="home-official-note">Independent civic information for everyone in Nigeria</div>
      <header className="home-header">
        <Brand inverse flag />
        <button className="home-menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-label={menuOpen ? 'Close menu' : 'Open menu'}>{menuOpen ? 'Close' : 'Menu'}</button>
        {menuOpen && <nav className="home-menu" aria-label="Main navigation"><a href="/chat">Ask Citizen</a><a href="#about">About Citizen</a><a href="#explore">Explore</a><a href="#how-it-works">How it works</a><a href="/admin">Team sign in</a></nav>}
      </header>

      <main>
        <section className="home-hero">
          <h1>Hello, Nigeria.</h1>
          <p>Curious about how things work? Start here.</p>
          <div className="home-hero-photo">
            {heroSlides.map((slide, index) => <img className={`hero-slide-image ${index === slideIndex ? 'is-active' : ''}`} src={slide.image} alt="" aria-hidden="true" key={slide.image} />)}
            <form className="home-ask" onSubmit={(event) => { event.preventDefault(); askCitizen(question || activeSlide.question) }}>
              <label className="sr-only" htmlFor="home-question">Describe what you need to understand</label>
              <input id="home-question" value={question} onChange={(event) => setQuestion(event.target.value)} onFocus={() => setSlidePaused(true)} onBlur={() => setSlidePaused(false)} placeholder={`Try “${activeSlide.preview}”`} />
              <button type="submit" aria-label="Ask Citizen"><ArrowRight size={20} /></button>
            </form>
            <div className="home-slide-controls" aria-label="Choose an example question">{heroSlides.map((slide, index) => <button key={slide.image} type="button" className={index === slideIndex ? 'is-active' : ''} onClick={() => setSlideIndex(index)} aria-label={`Show example ${index + 1}: ${slide.question}`} aria-pressed={index === slideIndex} />)}</div>
            <span className="home-photo-caption">Find the passage. Understand the answer.</span>
          </div>
          <div className="home-examples"><span>Try asking</span>{examples.map((example) => <button key={example} onClick={() => askCitizen(example)}>{example}</button>)}</div>
        </section>

        <section className="home-statement" id="about"><span className="home-eyebrow">PUBLIC INFORMATION, MADE CLEARER</span><h2>One question can open the right document.</h2><div className="statement-bottom"><p>From your rights to the way public institutions work, Citizen helps you find a useful starting point in Nigerian civic documents.</p><a href="/chat">Ask Citizen <ArrowRight size={18} /></a></div></section>

        <section className="home-source" id="how-it-works"><div className="source-illustration" aria-hidden="true"><div className="source-document source-document-back"><span>PUBLIC DOCUMENT</span><strong>Nigeria Police Act</strong><i /><i /><i /></div><div className="source-document source-document-front"><span>DOCUMENT LIBRARY</span><strong>Constitution of the Federal Republic of Nigeria</strong><div className="document-lines"><i /><i /><i /><i /></div><small>Find the original text behind an answer</small></div><div className="source-float"><FileText size={18} /> Source attached to the answer</div></div><div className="source-copy"><span className="home-eyebrow">KNOW WHERE IT CAME FROM</span><h2>Answers should lead back to the source.</h2><p>Citizen is being built around an approved collection of Nigerian public documents. Ask in your own words, find relevant passages, then read the original wording for yourself.</p><div className="source-steps"><div><span>01</span><strong>Ask a plain question</strong></div><div><span>02</span><strong>Find the relevant passage</strong></div><div><span>03</span><strong>Check the document</strong></div></div></div></section>

        <section className="home-topics"><div className="topics-heading"><span className="home-eyebrow">A PLACE TO START</span><h2>What’s on your mind?</h2><p>You don’t need to know the exact law or office. Start with the question you actually have.</p></div><div className="topic-list"><button onClick={() => askCitizen('What rights does the Nigerian Constitution protect?')}><span>01</span><strong>Rights & responsibilities</strong><ArrowUp size={20} /></button><button onClick={() => askCitizen('What does the Nigeria Police Act say about police powers?')}><span>02</span><strong>Police & public safety</strong><ArrowUp size={20} /></button><button onClick={() => askCitizen('How are federal, state and local government responsibilities divided?')}><span>03</span><strong>Government & public services</strong><ArrowUp size={20} /></button><button onClick={() => askCitizen('What are the rules for voting in Nigeria?')}><span>04</span><strong>Elections & participation</strong><ArrowUp size={20} /></button></div></section>

        <section className="home-explore" id="explore"><div className="explore-heading"><span className="home-eyebrow">BEYOND THE CHAT</span><h2>More ways to find your way.</h2><p>Focused experiences for the moments when a question needs more than an answer.</p></div><div className="explore-layout"><article className="explore-election"><span>COMING SOON · ELECTIONS 2027</span><div><h3>Know where and how to vote.</h3><p>A clear home for voting information and election resources.</p></div></article><div className="explore-side"><article className="explore-hotlines"><MessageCircle size={24} strokeWidth={1.6} /><div><span>COMING SOON</span><h3>Useful hotlines</h3><p>Important numbers, easy to find when they matter.</p></div></article><article className="explore-december"><Globe2 size={24} strokeWidth={1.6} /><div><span>COMING SOON</span><h3>December in Nigeria</h3><p>Ideas and events for the season ahead.</p></div></article></div></div></section>

        <section className="home-promise"><div><span className="home-eyebrow">READ THE SOURCE</span><h2>The document matters.</h2></div><p>Citizen can make mistakes. Follow the source for the exact wording, and use the relevant authority or a qualified professional when you need official or legal advice.</p></section>
      </main>
      <footer className="home-footer"><div><Brand inverse /><p>Clearer public information for everyone in Nigeria.</p></div><div className="footer-links"><a href="/chat">Ask Citizen</a><a href="#about">About</a><a href="#explore">Explore</a><a href="/admin">Team sign in</a></div><span>Independent civic information · Citizen.ng</span></footer>
    </div>
  )
}

function ChatPage() {
  const initialQuestion = new URLSearchParams(window.location.search).get('q') || ''
  const [input, setInput] = useState(initialQuestion)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [retryQuestion, setRetryQuestion] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const inputRef = useRef(null)
  const endRef = useRef(null)
  const autoSent = useRef(false)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (messages.length) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [messages, loading])

  const sendMessage = useCallback(async (event, retry = false, providedQuestion = '') => {
    event?.preventDefault()
    const question = (providedQuestion || (retry ? retryQuestion : input)).trim()
    if (!question || loading) return
    if (!retry) {
      setMessages((current) => [...current, { role: 'user', text: question }])
      setRetryQuestion(question)
      setInput('')
    }
    setError('')
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: question }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Citizen could not answer right now.')
      setMessages((current) => [...current, { role: 'assistant', text: payload.answer, citations: payload.citations || [] }])
      setRetryQuestion('')
    } catch (sendError) {
      setError(sendError.message === 'Failed to fetch' ? 'The Citizen chat service is not connected yet. Your question is still here; try again when it is ready.' : sendError.message)
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }, [input, loading, retryQuestion])

  useEffect(() => {
    if (initialQuestion && !autoSent.current) {
      autoSent.current = true
      sendMessage(null, false, initialQuestion)
    }
  }, [initialQuestion, sendMessage])

  function startNewChat() {
    setMessages([])
    setInput('')
    setError('')
    setRetryQuestion('')
    window.history.replaceState({}, '', '/chat')
    inputRef.current?.focus()
  }

  return (
    <div className="chat-shell">
      <main className="chat-main">
        <header className="chat-topbar"><Brand /><button className="chat-menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-label={menuOpen ? 'Close menu' : 'Open menu'}>{menuOpen ? 'Close' : 'Menu'}</button>{menuOpen && <nav className="chat-menu" aria-label="Chat navigation"><button onClick={() => { startNewChat(); setMenuOpen(false) }}>New conversation</button><a href="/">Home</a><a href="/admin">Team sign in</a></nav>}</header>
        <div className={`chat-content ${messages.length ? 'chat-content-active' : ''}`}>
          {messages.length === 0 ? (
            <div className="chat-welcome">
              <span className="chat-eyebrow">CITIZEN CHAT</span>
              <h1>Ask about public life in Nigeria.</h1>
              <p className="welcome-subtitle">Start with a question. Citizen will look for support in its document library and show you the sources it uses.</p>
              <div className="question-suggestions">
                <span className="suggestions-label">TRY A QUESTION</span>
                {promptIdeas.map((idea) => <button key={idea} onClick={() => sendMessage(null, false, idea)}>{idea}<ArrowRight size={15} /></button>)}
              </div>
            </div>
          ) : (
            <div className="conversation-list">
              {messages.map((message, index) => <article className={`message message-${message.role}`} key={`${message.role}-${index}`}>
                <div className="message-body">{message.role === 'assistant' && <span className="message-author">CITIZEN</span>}{message.role === 'assistant' ? <AnswerMarkdown text={message.text} citations={message.citations || []} /> : <p>{message.text}</p>}
                  {message.citations?.length > 0 && <SourceCards citations={message.citations} />}
                </div>
              </article>)}
              {loading && <div className="source-status"><span className="status-pulse" /> Checking the document library…</div>}
              {error && <div className="chat-error" role="alert"><CircleHelp size={16} /><span>{error}</span><button onClick={() => sendMessage(null, true)}>Try again</button></div>}
              <div ref={endRef} />
            </div>
          )}
          <div className="composer-wrap">
            <form className="composer" onSubmit={sendMessage}>
              <label className="sr-only" htmlFor="chat-input">Ask a question about Nigeria</label>
              <textarea id="chat-input" ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage() } }} placeholder="Ask Citizen…" rows={1} />
              <button aria-label="Send question" type="submit" disabled={!input.trim() || loading}><ArrowUp size={19} /></button>
            </form>
            <p className="composer-note">Check the source for the exact wording.</p>
          </div>
        </div>
      </main>
    </div>
  )
}

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}

function AdminDocuments({ onNotice, navigate }) {
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const load = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/admin/documents`, { credentials: 'include' })
      if (!response.ok) throw new Error('Could not load documents.')
      setItems(await response.json())
    } catch (error) { onNotice(error.message) }
  }, [onNotice])
  useEffect(() => { const timer = setTimeout(load, 0); return () => clearTimeout(timer) }, [load])
  async function upload(event) {
    event.preventDefault()
    setBusy(true)
    try {
      const response = await fetch(`${API_BASE}/api/admin/documents`, { method: 'POST', credentials: 'include', body: new FormData(event.currentTarget) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Upload failed.')
      navigate(`/admin/documents/${body.id}`)
    } catch (error) { onNotice(error.message); setBusy(false) }
  }
  return <div className="documents-workspace">
    <div className="documents-toolbar"><div><span className="document-eyebrow">SOURCE LIBRARY</span><p>{items.length} document{items.length === 1 ? '' : 's'} available to manage</p></div><button className="button button-primary" onClick={() => setShowUpload(!showUpload)}>{showUpload ? 'Close form' : '+ Add document'}</button></div>
    {showUpload && <form className="document-upload" onSubmit={upload}>
      <h2>Add a document</h2><p>Upload a PDF, DOCX, or TXT file. It will wait for review before appearing in chat.</p>
      <label>Title<input name="title" required maxLength="300" placeholder="Constitution of the Federal Republic of Nigeria" /></label>
      <label>Official source URL<input name="sourceUrl" type="url" placeholder="https://…" /></label>
      <label>Version or year<input name="versionLabel" placeholder="1999, as amended" /></label>
      <label>Document file<input name="file" type="file" accept=".pdf,.docx,.txt" required /></label>
      <button className="button button-primary" disabled={busy}>{busy ? 'Uploading…' : 'Upload document'}</button>
    </form>}
    {items.length === 0 ? <div className="documents-empty"><FileText size={28} /><h2>No documents yet.</h2><p>Upload a source to start the library.</p></div> : <div className="documents-list" aria-label="Documents">
      {items.map((item) => <a key={item.id} className="document-row" href={`/admin/documents/${item.id}`} onClick={(event) => { if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navigate(`/admin/documents/${item.id}`) } }}><span className="document-row-icon"><FileText size={21} /></span><span className="document-row-main"><strong>{item.title}</strong><small>{item.versionLabel || item.fileName} <span aria-hidden="true">·</span> Added {formatDate(item.createdAt)}</small></span><em className={`document-status status-${item.status}`}>{item.status}</em><span className="document-row-open"><ArrowRight size={18} /></span></a>)}
    </div>}
  </div>
}

function AdminDocumentDetail({ id, onNotice, navigate }) {
  const [doc, setDoc] = useState(null)
  const [chunks, setChunks] = useState([])
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const load = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/admin/documents/${id}`, { credentials: 'include' })
      if (!response.ok) throw new Error('Could not load this document.')
      const item = await response.json()
      setDoc(item)
      const passages = await fetch(`${API_BASE}/api/admin/documents/${id}/chunks`, { credentials: 'include' })
      if (passages.ok) setChunks(await passages.json())
      setLoading(false)
    } catch (error) { onNotice(error.message); setLoading(false) }
  }, [id, onNotice])
  useEffect(() => { const timer = setTimeout(load, 0); return () => clearTimeout(timer) }, [load, refreshKey])
  useEffect(() => {
    if (doc?.status !== 'processing') return
    const timer = setInterval(load, 5000)
    return () => clearInterval(timer)
  }, [doc?.status, load])
  useEffect(() => {
    let url
    let cancelled = false
    async function getPreview() {
      try {
        const metadata = await fetch(`${API_BASE}/api/admin/documents/${id}`, { credentials: 'include' }).then((response) => response.json())
        if (metadata.contentType === 'application/pdf') {
          const response = await fetch(`${API_BASE}/api/admin/documents/${id}/source`, { credentials: 'include' })
          if (!response.ok) return
          url = URL.createObjectURL(await response.blob())
          if (cancelled) URL.revokeObjectURL(url)
          else setPreview({ kind: 'pdf', value: url })
        } else {
          const response = await fetch(`${API_BASE}/api/admin/documents/${id}/text`, { credentials: 'include' })
          if (response.ok) {
            const value = await response.text()
            if (!cancelled) setPreview({ kind: 'text', value })
          }
        }
      } catch { /* The source link remains available if preview fails. */ }
    }
    getPreview()
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url) }
  }, [id, doc?.status])
  async function action(kind, step) {
    setBusy(true)
    try {
      const response = await fetch(`${API_BASE}/api/admin/documents/${id}/${kind}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(step ? { step } : {}) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not update document.')
      onNotice(kind === 'retry' ? 'Processing restarted.' : kind === 'publish' ? 'Document published.' : 'Document archived.')
      setRefreshKey((value) => value + 1)
    } catch (error) { onNotice(error.message) } finally { setBusy(false) }
  }
  async function loadMore() {
    const response = await fetch(`${API_BASE}/api/admin/documents/${id}/chunks?offset=${chunks.length}`, { credentials: 'include' })
    if (response.ok) {
      const more = await response.json()
      setChunks((current) => [...current, ...more])
    }
  }
  if (loading) return <p className="document-loading">Loading document…</p>
  if (!doc) return <p className="document-loading">Document not found. <a href="/admin" onClick={(event) => { event.preventDefault(); navigate('/admin') }}>Back to documents</a></p>
  const completed = doc.status === 'review' || doc.status === 'published' || doc.status === 'archived'
  return <div className="document-page">
    <a className="document-back" href="/admin" onClick={(event) => { if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navigate('/admin') } }}><ArrowLeft size={16} /> All documents</a>
    <div className="document-page-header"><div><span className="document-eyebrow">DOCUMENT RECORD</span><h1>{doc.title}</h1><p>{doc.summary || 'The summary will appear after processing.'}</p></div><div className="document-page-controls"><em className={`document-status status-${doc.status}`}>{doc.status}</em><div className="document-page-actions">{doc.status === 'review' && <button className="button button-primary" disabled={busy} onClick={() => action('publish')}>Publish to chat</button>}{doc.status === 'published' && <button className="button" disabled={busy} onClick={() => action('archive')}>Archive</button>}{(doc.status === 'failed' || doc.status === 'archived') && <button className="button button-primary" disabled={busy} onClick={() => action('retry', doc.steps?.find((step) => step.status === 'failed')?.name || 'extract')}>Retry processing</button>}</div></div></div>
    <div className="document-facts"><div><span>FILE</span><strong>{doc.fileName}</strong></div><div><span>ADDED</span><strong>{formatDate(doc.createdAt)}</strong></div><div><span>VERSION</span><strong>{doc.versionLabel || 'Not set'}</strong></div><div><span>TYPE</span><strong>{doc.documentType || 'Pending'}</strong></div><div><span>JURISDICTION</span><strong>{doc.jurisdiction || 'Pending'}</strong></div><div><span>SEARCH INDEX</span><strong>{doc.embeddedCount} / {doc.chunkCount} passages</strong></div></div>
    {doc.sourceUrl && <a className="document-official-link" href={doc.sourceUrl} target="_blank" rel="noreferrer">Official source <ArrowUp size={14} /></a>}
    {doc.lastError && <p className="document-error" role="alert">{doc.lastError}</p>}
    {!completed && doc.steps?.length > 0 && <div className="document-progress"><h2>Processing</h2><div>{doc.steps.map((step) => <span key={step.name}>{step.name} <strong>{step.status}</strong>{step.attempts > 0 && <small> · {step.attempts} attempt{step.attempts === 1 ? '' : 's'}</small>}</span>)}</div></div>}
    <div className="document-content-grid"><section className="document-source"><div className="document-section-head"><div><span className="document-eyebrow">ORIGINAL SOURCE</span><h2>Document preview</h2><p>The uploaded file, exactly as received.</p></div><a href={`${API_BASE}/api/admin/documents/${id}/source`} target="_blank" rel="noreferrer">Open file <ArrowUp size={14} /></a></div>{preview?.kind === 'pdf' ? <iframe title={`${doc.title} source`} src={preview.value} /> : preview?.kind === 'text' ? <pre>{preview.value}</pre> : <div className="document-preview-empty">Preview will appear when the source is ready.</div>}</section>
    <section className="document-passages"><div className="document-section-head"><div><span className="document-eyebrow">SEARCH MATERIAL</span><h2>Passages</h2><p>{doc.chunkCount} passages · {doc.embeddedCount} embedded</p></div></div>{chunks.length ? <div className="passage-list">{chunks.map((chunk) => <article key={chunk.id}><div><span className="passage-number">{String(chunk.ordinal + 1).padStart(2, '0')}</span><div><strong>{chunk.section || 'Untitled section'}</strong><span>Page {chunk.page} · {chunk.embedded ? 'Embedded' : 'Not embedded yet'}</span></div></div><p>{chunk.content}</p></article>)}</div> : <p className="passage-empty">Passages will appear after chunking.</p>}{chunks.length < doc.chunkCount && <button className="button" onClick={loadMore}>Show more passages</button>}</section></div>
  </div>
}

function AdminPage() {
  const [admin, setAdmin] = useState(null)
  const [status, setStatus] = useState('loading')
  const [path, setPath] = useState(window.location.pathname)
  const detailId = path.match(/^\/admin\/documents\/([0-9a-f-]+)$/)?.[1]
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])
  function navigate(nextPath) {
    if (nextPath === path) return
    window.history.pushState({}, '', nextPath)
    setPath(nextPath)
    setNotice('')
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  useEffect(() => {
    fetch(`${API_BASE}/api/admin/me`, { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) throw new Error('signed-out')
        return response.json()
      })
      .then((identity) => { setAdmin(identity); setStatus('ready') })
      .catch(() => setStatus('signed-out'))
  }, [])

  async function signOut() {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {})
    setAdmin(null)
    setStatus('signed-out')
  }

  if (status === 'loading') return <div className="admin-loading"><p>Checking your admin session…</p></div>
  if (status === 'signed-out') return <main className="admin-gate"><Brand /><div className="gate-card"><div className="gate-icon"><ShieldCheck size={21} /></div><h1>For the Citizen team.</h1><p>Sign in with a Google account on the admin allowlist to manage the document library.</p><a className="button button-primary" href={`${API_BASE}/auth/google`}>Continue with Google <ArrowRight size={16} /></a><a className="gate-home" href="/">Back to citizen.ng</a></div><span className="gate-note">PRIVATE WORKSPACE · ALLOWLISTED ACCOUNTS ONLY</span></main>

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar"><Brand /><div className="admin-sidebar-title">CONTENT STUDIO</div><nav aria-label="Content management"><a className="admin-nav-active" href="/admin" onClick={(event) => { event.preventDefault(); navigate('/admin') }}><BookOpen size={17} />Documents</a></nav><div className="admin-sidebar-bottom"><a href="/" target="_blank" rel="noreferrer"><Globe2 size={15} /> View Citizen.ng <ArrowUp size={13} /></a><div className="admin-user"><span className="admin-avatar">{admin?.email?.[0]?.toUpperCase() || 'C'}</span><div><strong>{admin?.email}</strong><small>Administrator</small></div><button title="Sign out" onClick={signOut}><ArrowLeft size={15} /></button></div></div></aside>
      <main className="admin-main"><header className="admin-topbar"><span>Content / <strong>{detailId ? 'Document' : 'Documents'}</strong></span><a href="/chat">Open chat <ArrowUp size={13} /></a></header><section className="admin-workspace">{detailId ? <>{notice && <p className="admin-notice" role="status">{notice}</p>}<AdminDocumentDetail id={detailId} onNotice={setNotice} navigate={navigate} /></> : <><div className="admin-title-row"><div><span className="section-label">CITIZEN.NG · CONTENT</span><h1>Documents</h1><p>Manage the sources used by Citizen chat.</p></div></div>{notice && <p className="admin-notice" role="status">{notice}</p>}<AdminDocuments onNotice={setNotice} navigate={navigate} /></>}</section></main>
    </div>
  )
}

export default function App() {
  const path = window.location.pathname
  if (path.startsWith('/source/')) return <PDFSourcePage />
  if (path === '/chat') return <ChatPage />
  if (path.startsWith('/admin')) return <AdminPage />
  return <LandingPage />
}
