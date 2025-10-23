// // import React from 'react';
// // const HistoryDetailPage: React.FC = () => {
// //     return <h1>[Dashboard] 진단 기록 상세 보기</h1>;
// //     };
// // export default HistoryDetailPage;
// // export {};
// // frontend/src/pages/dashboard/HistoryDetailPage.tsx
// import React from "react";
// import { useNavigate, useParams } from "react-router-dom";
//
// const HistoryDetailPage: React.FC = () => {
//   const navigate = useNavigate();
//   const { folderName } = useParams();
//
//   return (
//     <div className="w-full max-w-md mx-auto bg-gray-50 min-h-screen px-4 py-6">
//       {/* 뒤로가기 버튼 */}
//       <button
//         onClick={() => navigate(-1)}
//         className="text-sm text-gray-600 hover:text-black mb-4 flex items-center gap-1"
//       >
//         <span className="text-lg">←</span> 뒤로가기
//       </button>
//
//       <h2 className="text-lg font-semibold mb-2">
//         {folderName} 폴더 상세 기록
//       </h2>
//       <p className="text-sm text-gray-500">
//         [Dashboard] 진단 기록 상세 보기
//       </p>
//     </div>
//   );
// };
//
// export default HistoryDetailPage;
// frontend/src/pages/dashboard/HistoryDetailPage.tsx
// import React, { useEffect, useState } from "react";
// import { useNavigate, useParams } from "react-router-dom";
// import axios from "axios";
//
// interface RecordItem {
//   id: number;
//   analysis_date: string;
//   risk_level: string;
//   disease: { name_ko: string };
//   photo: {
//     body_part: string;
//     folder_name: string;
//     capture_date: string;
//     upload_storage_path: string;
//   };
// }
//
// const HistoryDetailPage: React.FC = () => {
//   const navigate = useNavigate();
//   const { folderName } = useParams();
//   const [records, setRecords] = useState<RecordItem[]>([]);
//   const [error, setError] = useState<string | null>(null);
//
//   useEffect(() => {
//     const fetchFolderRecords = async () => {
//       try {
//         const res = await axios.get<RecordItem[]>("/api/dashboard/records/", {
//           params: { folder: folderName },
//         });
//         setRecords(res.data);
//       } catch (err) {
//         console.error(err);
//         setError("폴더 데이터를 불러오는 중 오류가 발생했습니다.");
//       }
//     };
//     fetchFolderRecords();
//   }, [folderName]);
//
//   if (error)
//     return (
//       <div className="flex items-center justify-center h-screen text-red-500">
//         {error}
//       </div>
//     );
//
//   return (
//     <div className="w-full max-w-md mx-auto bg-gray-50 min-h-screen px-4 py-6">
//       {/* 뒤로가기 버튼 */}
//       <button
//         onClick={() => navigate(-1)}
//         className="text-sm text-gray-600 hover:text-black mb-4 flex items-center gap-1"
//       >
//         <span className="text-lg">←</span> 뒤로가기
//       </button>
//
//       <h2 className="text-lg font-semibold mb-4">
//         {folderName} 폴더 상세 기록
//       </h2>
//
//       {records.length === 0 ? (
//         <p className="text-sm text-gray-500">해당 폴더의 진단 기록이 없습니다.</p>
//       ) : (
//         <div className="space-y-3">
//           {records.map((item) => (
//             <div
//               key={item.id}
//               className="flex items-center bg-white rounded-lg shadow-sm p-3"
//             >
//               <img
//                 src={`http://127.0.0.1:8000${item.photo.upload_storage_path}`}
//                 alt="record"
//                 className="w-14 h-14 rounded-md object-cover mr-3 border border-gray-200"
//               />
//               <div className="flex-1 text-left">
//                 <p className="text-sm font-semibold text-gray-800">
//                   {item.disease.name_ko}
//                 </p>
//                 <p className="text-xs text-gray-500">
//                   진단일: {item.analysis_date.split("T")[0]}
//                 </p>
//                 <p className="text-xs text-gray-500">
//                   신체 부위: {item.photo.body_part}
//                 </p>
//                 <p className="text-xs text-gray-500">
//                   위험도:{" "}
//                   <span
//                     className={
//                       item.risk_level === "높음"
//                         ? "text-red-500 font-semibold"
//                         : item.risk_level === "중간"
//                         ? "text-yellow-500 font-semibold"
//                         : "text-green-500 font-semibold"
//                     }
//                   >
//                     {item.risk_level}
//                   </span>
//                 </p>
//               </div>
//             </div>
//           ))}
//         </div>
//       )}
//     </div>
//   );
// };
//
// export default HistoryDetailPage;

import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";

interface RecordItem {
  id: number;
  analysis_date: string;
  risk_level: string;
  disease: { name_ko: string };
  photo: {
    body_part: string;
    folder_name: string;
    capture_date: string;
    upload_storage_path: string;
  };
}

const HistoryDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { folderName } = useParams();
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFolderRecords = async () => {
      try {
        const res = await axios.get<RecordItem[]>("/api/dashboard/records/", {
          params: { folder: folderName },
        });
        setRecords(res.data);
      } catch (err) {
        console.error(err);
        setError("폴더 데이터를 불러오는 중 오류가 발생했습니다.");
      }
    };
    fetchFolderRecords();
  }, [folderName]);

  if (error)
    return (
      <div className="flex items-center justify-center h-screen text-red-500">
        {error}
      </div>
    );

  return (
    <div className="w-full max-w-md mx-auto bg-gray-50 min-h-screen px-4 py-5">
      {/* 상단 영역 */}
      <div className="flex items-center mb-4">
        <button
          onClick={() => navigate(-1)}
          className="text-lg text-gray-700 hover:text-black mr-2"
        >
          ←
        </button>
        <h2 className="text-lg font-semibold">병원에서 체크중</h2>
      </div>

      {/* 기록 목록 */}
      <div className="space-y-3">
        {records.map((item) => (
          <div
            key={item.id}
            className="flex items-center bg-white rounded-xl shadow-sm p-3"
          >
            {/* 이미지 */}
            <img
              src={`http://127.0.0.1:8000${item.photo.upload_storage_path}`}
              alt="record"
              className="w-16 h-16 rounded-md object-cover border border-gray-200 mr-3"
            />

            {/* 텍스트 정보 */}
            <div className="flex-1 text-left leading-tight">
              <p className="text-sm font-semibold text-gray-800">
                {item.disease?.name_ko || "병변 이름 미상"}
              </p>
              <p className="text-xs text-gray-500">
                위험도:{" "}
                <span
                  className={
                    item.risk_level === "높음"
                      ? "text-red-500 font-semibold"
                      : item.risk_level === "중간"
                      ? "text-yellow-500 font-semibold"
                      : "text-green-500 font-semibold"
                  }
                >
                  {item.risk_level}
                </span>
              </p>
              <p className="text-xs text-gray-500">
                저장 날짜: {item.analysis_date.split("T")[0]}
              </p>
              <p className="text-xs text-gray-500">
                신체 부위: {item.photo.body_part}
              </p>
            </div>

            {/* > 아이콘 */}
            <div className="text-gray-400 text-sm">{">"}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HistoryDetailPage;
