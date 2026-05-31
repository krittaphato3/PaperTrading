import React, { Suspense } from 'react'

const Dashboard = React.lazy(() => import('./components/Dashboard'))

export default function App() {
  return (
    <Suspense fallback={<div className="tv-loading"><div className="tv-spinner"/><span>Loading dashboard...</span></div>}>
      <Dashboard />
    </Suspense>
  )
}
