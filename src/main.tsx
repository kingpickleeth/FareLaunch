import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './styles/theme.css'
import App from './App'
import SaleList from './pages/SaleList.tsx'
import SaleDetail from './pages/SaleDetail.tsx'
import LaunchWizard from './pages/LaunchWizard.tsx'
import Locker from './pages/Locker.tsx'
import { Buffer } from 'buffer';
(window as any).Buffer ||= Buffer;
const router = createBrowserRouter([
  { path: '/', element: <App />, children: [
    { index: true, element: <SaleList /> },
    { path: 'sale/:id', element: <SaleDetail /> },
    { path: 'launch', element: <LaunchWizard /> },
    { path: 'locker', element: <Locker /> },
  ] }
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router}/>
  </React.StrictMode>
)
