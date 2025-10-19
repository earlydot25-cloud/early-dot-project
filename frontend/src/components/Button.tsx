import React from 'react';

const Button: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return <button>{children}</button>;
    };
export default Button;