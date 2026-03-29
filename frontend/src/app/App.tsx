import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { HomePage } from '@/features/home';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
      </Routes>
    </BrowserRouter>
  );
}
