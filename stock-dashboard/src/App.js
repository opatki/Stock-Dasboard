import "./App.css";
import Home from './pages/Home.js'
import StockDetail from './pages/StockDetail.js'

import { Routes, Route } from "react-router-dom";

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/stock/:ticker" element={<StockDetail />} />
    </Routes>
  );
}

export default App;