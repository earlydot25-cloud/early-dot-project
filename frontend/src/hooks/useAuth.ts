import { useState } from 'react';

export const useAuth = () => {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const login = () => setIsLoggedIn(true);
    const logout = () => setIsLoggedIn(false);
    return { isLoggedIn, login, logout };
    };

// 이 파일은 훅만 export 하므로 export default는 사용하지 않습니다.
export {};