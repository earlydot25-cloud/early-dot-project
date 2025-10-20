import React from 'react';

import { Link } from 'react-router-dom';

const MainPage: React.FC = () => {
    return (
        <div>
         <h1>Early Dot Project: 메인 시작 화면</h1>
         <p>팀원들은 <Link to="/diagnosis">진단 시작</Link> 또는 <Link to="/dashboard">기록 조회</Link>를 선택하세요.</p>
          </div> );
          };

export default MainPage;
export {};