import { useState, useEffect } from 'react'
import Landing from './components/Landing.jsx'
import Presenter from './components/Presenter.jsx'
import Participant from './components/Participant.jsx'

function currentRoute() {
  const hash = window.location.hash.replace('#', '')
  const [page, code] = hash.split('/')
  if (page === 'present') return { page: 'present', code: code || null }
  if (page === 'join') return { page: 'join', code: code || null }
  return { page: 'landing', code: null }
}

export default function App() {
  const [route, setRoute] = useState(currentRoute)

  useEffect(() => {
    const onHash = () => setRoute(currentRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (route.page === 'present') return <Presenter roomCode={route.code} />
  if (route.page === 'join') return <Participant roomCode={route.code} />
  return <Landing />
}
