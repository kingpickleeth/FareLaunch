import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './styles/theme.css'
import App from './App'
import Explore from './pages/Explore.tsx';
import SaleDetail from './pages/SaleDetail.tsx'
import LaunchWizard from './pages/LaunchWizard.tsx'
import Locker from './pages/Locker.tsx'
import { WalletProvider } from './lib/wallet';
import MyLaunches from './pages/MyLaunches';
import Tools from './pages/Tools';
import Simulator from './pages/SimulatorPage'

const router = createBrowserRouter([
  { path: '/', element: <App />, children: [
    { index: true, element: <Explore /> },
    { path: 'sale/:id', element: <SaleDetail /> },
    { path: 'launch', element: <LaunchWizard /> },
    { path: 'locker', element: <Locker /> },
    { path: 'me', element: <MyLaunches /> },
    { path: 'tools', element: <Tools /> },
    { path: 'simulator', element: <Simulator /> },
  ] }
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
        <WalletProvider>
    <RouterProvider router={router}/>
    </WalletProvider>
  </React.StrictMode>
)
