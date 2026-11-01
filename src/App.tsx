import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Shell } from './components/Shell'
import { Landing, Foundations } from './pages/Public'
import { SignIn, SignUp, Verify, Reset, NewPassword } from './pages/Auth'
import { Onboarding } from './pages/Onboarding'
import { Home } from './pages/Home'
import { Review } from './pages/Review'
import { Inbox } from './pages/Inbox'
import { FollowUps, CalendarPage, AgentPage } from './pages/Work'
import { Pipeline, DealDetail } from './pages/Pipeline'
import { Contacts, ContactDetail, Companies, CompanyDetail } from './pages/Crm'
import { Templates } from './pages/Templates'
import { Reports } from './pages/Reports'
import { Settings } from './pages/Settings'

function ScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

export default function App() {
  return (
    <>
      <ScrollTop />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/sign-up" element={<SignUp />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/reset" element={<Reset />} />
        <Route path="/new-password" element={<NewPassword />} />
        <Route path="/onboarding" element={<Navigate to="/onboarding/1" replace />} />
        <Route path="/onboarding/:step" element={<Onboarding />} />
        <Route path="/foundations" element={<Foundations />} />
        <Route path="/app" element={<Shell />}>
          <Route index element={<Navigate to="home" replace />} />
          <Route path="home" element={<Home />} />
          <Route path="review" element={<Review />} />
          <Route path="inbox" element={<Inbox />} />
          <Route path="follow-ups" element={<FollowUps />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="agent" element={<AgentPage />} />
          <Route path="pipeline" element={<Pipeline />} />
          <Route path="pipeline/:id" element={<DealDetail />} />
          <Route path="contacts" element={<Contacts />} />
          <Route path="contacts/:id" element={<ContactDetail />} />
          <Route path="companies" element={<Companies />} />
          <Route path="companies/:id" element={<CompanyDetail />} />
          <Route path="templates" element={<Templates />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Navigate to="profile" replace />} />
          <Route path="settings/:tab" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
