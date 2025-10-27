// // // frontend/src/pages/dashboard/HistoryResultPage.tsx
// // import React, { useEffect, useState } from "react";
// // import axios from "axios";
// // import { useNavigate, useParams, useLocation } from "react-router-dom";
// //
// // interface RecordDetail {
// //   id: number;
// //   analysis_date: string;
// //   risk_level: string;
// //   vlm_analysis_text: string;
// //   disease: { name_ko: string };
// //   photo: { folder_name: string };
// // }
// //
// // const HistoryResultPage: React.FC = () => {
// //   const { folderName, resultId } = useParams();
// //   const navigate = useNavigate();
// //   const location = useLocation();
// //   const query = new URLSearchParams(location.search);
// //   const userId = query.get("user");
// //
// //   const { userName, folderDisplay, diseaseName } = (location.state || {}) as {
// //     userName?: string;
// //     folderDisplay?: string;
// //     diseaseName?: string;
// //   };
// //
// //   const [data, setData] = useState<RecordDetail | null>(null);
// //
// //   useEffect(() => {
// //     axios
// //       .get<RecordDetail>(`/api/dashboard/records/${resultId}/`)
// //       .then((res) => setData(res.data))
// //       .catch(() => setData(null));
// //   }, [resultId]);
// //
// //   const finalUser = userName || "환자";
// //   const finalFolder = folderDisplay || data?.photo?.folder_name || folderName;
// //   const finalDisease = data?.disease?.name_ko || diseaseName || "질환명";
// //
// //   return (
// //     <div className="w-full max-w-md mx-auto bg-gray-50 min-h-screen px-4 py-5">
// //       <button
// //         onClick={() => navigate(-1)}
// //         className="text-sm text-gray-600 mb-3 flex items-center gap-1 hover:text-black"
// //       >
// //         ← 뒤로가기
// //       </button>
// //
// //       {/* ✅ DB에서 불러온 폴더명 반영 */}
// //       <p className="text-xs text-gray-500 mb-2 text-left">
// //         {`${finalUser} > ${finalFolder} > ${finalDisease}`}
// //       </p>
// //
// //       <h2 className="text-lg font-bold mb-2 text-left">
// //         {finalDisease} ({data?.risk_level || "정보 없음"})
// //       </h2>
// //
// //       <p className="text-xs text-gray-500 mb-4 text-left">
// //         진단일: {data?.analysis_date?.split("T")[0] || "정보 없음"}
// //       </p>
// //
// //       <p className="text-sm text-gray-700 mb-5 text-left">
// //         {data?.vlm_analysis_text || "AI 분석 결과가 없습니다."}
// //       </p>
// //
// //       <h3 className="text-sm font-semibold text-left mb-1">설명</h3>
// //       <h3 className="text-sm font-semibold text-left">권장 조치</h3>
// //     </div>
// //   );
// // };
// //
// // export default HistoryResultPage;
//
// // frontend/src/pages/dashboard/HistoryResultPage.tsx
// import React, { useEffect, useState } from "react";
// import axios from "axios";
// import { useNavigate, useParams, useLocation } from "react-router-dom";
//
// interface DiseaseInfo {
//   name_ko: string;
//   name_en: string;
//   classification: string;
//   description: string;
//   recommendation: string;
// }
//
// interface PhotoInfo {
//   folder_name: string;
//   upload_storage_path: string;
//   body_part: string;
//   symptoms_itch: string;
//   symptoms_pain: string;
//   symptoms_color: string;
//   symptoms_infection: string;
//   symptoms_blood: string;
//   onset_date: string;
//   meta_age: number;
//   meta_sex: string;
//   capture_date: string;
// }
//
// interface FollowUpCheck {
//   current_status: string;
//   doctor_risk_level: string;
//   doctor_note: string;
//   last_updated_at: string;
// }
//
// interface ResultDetail {
//   id: number;
//   analysis_date: string;
//   risk_level: string;
//   class_probs: Record<string, number>;
//   grad_cam_path: string;
//   vlm_analysis_text: string;
//   photo: PhotoInfo;
//   disease: DiseaseInfo;
//   followup_check: FollowUpCheck | null;
// }
//
// const HistoryResultPage: React.FC = () => {
//   const { folderName, resultId } = useParams();
//   const location = useLocation();
//   const navigate = useNavigate();
//
//   const query = new URLSearchParams(location.search);
//   const userId = query.get("user");
//
//   const { userName } = (location.state || {}) as { userName?: string };
//
//   const [data, setData] = useState<ResultDetail | null>(null);
//
//   useEffect(() => {
//     axios
//       .get<ResultDetail>(`/api/dashboard/records/${resultId}/`)
//       .then((res) => setData(res.data))
//       .catch(() => setData(null));
//   }, [resultId]);
//
//   if (!data)
//     return (
//       <div className="w-full max-w-md mx-auto bg-gray-50 min-h-screen px-4 py-5 text-center">
//         <p>데이터를 불러오는 중입니다...</p>
//       </div>
//     );
//
//   const riskColor =
//     data.risk_level === "높음"
//       ? "bg-red-500"
//       : data.risk_level === "중간"
//       ? "bg-yellow-400"
//       : "bg-green-400";
//
//   return (
//     <div className="w-full max-w-md mx-auto bg-gray-50 min-h-screen px-4 py-5">
//       <button
//         onClick={() => navigate(-1)}
//         className="text-sm text-gray-600 mb-3 flex items-center gap-1 hover:text-black"
//       >
//         ← 뒤로가기
//       </button>
//
//       {/* 상단 주석 */}
//       <p className="text-xs text-gray-500 mb-2 text-left">
//         {`${userName || "환자"} > ${data.photo.folder_name} > ${data.disease.name_ko}`}
//       </p>
//
//       {/* 🚨 경고 표시 */}
//       {data.risk_level === "높음" && (
//         <div className="bg-red-100 text-red-600 border border-red-400 rounded-lg p-3 mb-4 text-sm font-semibold">
//           ⚠️ 주의: 전문의의 소견 **[즉시 주의]** 상태입니다.
//         </div>
//       )}
//
//       {/* AI 예측 및 이미지 */}
//       <div className="bg-white rounded-xl p-3 shadow-sm mb-4">
//         <h3 className="text-sm font-semibold mb-2">AI 예측 진단 및 이미지 분석</h3>
//         <div className="flex justify-around mb-3">
//           <button className="text-xs font-semibold text-blue-600 border-b-2 border-blue-600">
//             원본 환부 이미지
//           </button>
//           <button className="text-xs text-gray-500">AI GradCAM 분석</button>
//         </div>
//
//         <div className="w-full bg-gray-100 rounded-md overflow-hidden">
//           <img
//             src={`/${data.photo.upload_storage_path}`}
//             alt="original"
//             className="w-full h-auto"
//           />
//         </div>
//       </div>
//
//       {/* AI 진단명 / 위험도 */}
//       <div className="bg-white rounded-xl p-3 shadow-sm mb-4">
//         <p className="text-xs text-blue-600 font-semibold mb-1">AI 예측 진단명</p>
//         <p className="font-bold text-lg">
//           {data.disease.name_en} ({data.disease.name_ko})
//         </p>
//
//         <p className="text-xs text-red-600 mt-2">
//           AI 위험도: <b>{data.risk_level}</b>
//         </p>
//       </div>
//
//       {/* 전문의 최종 소견 */}
//       {data.followup_check && (
//         <div className="bg-red-50 border border-red-300 rounded-xl p-3 shadow-sm mb-4">
//           <p className="text-sm font-bold text-red-600 mb-1">전문의 최종 소견</p>
//           <p className="text-xs mb-2">
//             {data.followup_check.doctor_note || "소견이 등록되지 않았습니다."}
//           </p>
//           <p className="text-xs text-gray-500">
//             최종 판정: {data.followup_check.doctor_risk_level} / 업데이트일:{" "}
//             {data.followup_check.last_updated_at.split("T")[0]}
//           </p>
//         </div>
//       )}
//
//       {/* VLM 분석 결과 */}
//       <div className="bg-white rounded-xl p-3 shadow-sm mb-4">
//         <h3 className="text-sm font-semibold mb-2">VLM 모델 분석 소견</h3>
//         <p className="text-xs text-gray-700 whitespace-pre-wrap">
//           {data.vlm_analysis_text || "AI 모델의 세부 분석 결과가 없습니다."}
//         </p>
//       </div>
//
//       {/* 환자 기본 정보 */}
//       <div className="bg-white rounded-xl p-3 shadow-sm mb-4">
//         <h3 className="text-sm font-semibold mb-2">환자 기본 정보</h3>
//         <p className="text-xs text-gray-700">
//           나이 / 성별: {data.photo.meta_age}세 / {data.photo.meta_sex}
//         </p>
//         <p className="text-xs text-gray-700">환부 위치: {data.photo.body_part}</p>
//         <p className="text-xs text-gray-700">
//           가족력 유무: {data.photo.symptoms_infection === "있음" ? "있음" : "없음"}
//         </p>
//       </div>
//
//       {/* 주요 증상 및 히스토리 */}
//       <div className="bg-white rounded-xl p-3 shadow-sm mb-6">
//         <h3 className="text-sm font-semibold mb-2">주요 증상 및 특이사항</h3>
//         <p className="text-xs text-gray-700 mb-1">
//           발병 시점: {data.photo.onset_date || "정보 없음"}
//         </p>
//         <p className="text-xs text-gray-700">
//           통증: {data.photo.symptoms_pain} / 색 변화: {data.photo.symptoms_color}
//         </p>
//       </div>
//     </div>
//   );
// };
//
// export default HistoryResultPage;


// frontend/src/pages/dashboard/HistoryResultPage.tsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useParams, useNavigate, useLocation } from "react-router-dom";

interface Disease {
  name_ko: string;
  name_en: string;
  classification: string;
  description: string;
  recommendation: string;
}

interface Photo {
  folder_name: string;
  upload_storage_path: string;
  body_part: string;
  symptoms_itch: string;
  symptoms_pain: string;
  symptoms_color: string;
  symptoms_infection: string;
  symptoms_blood: string;
  onset_date: string;
  meta_age: number;
  meta_sex: string;
  capture_date: string;
}

interface FollowUp {
  doctor_risk_level: string;
  doctor_note: string;
  current_status: string;
  last_updated_at: string;
}

interface UserInfo {
  name: string;
  sex: string;
  age: number;
  family_history: string;
}

interface ResultDetail {
  id: number;
  analysis_date: string;
  risk_level: string;
  class_probs: Record<string, number>;
  grad_cam_path: string;
  vlm_analysis_text: string;
  disease: Disease;
  photo: Photo;
  followup_check: FollowUp | null;
  user: UserInfo;
}

const HistoryResultPage: React.FC = () => {
  const { folderName, resultId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const query = new URLSearchParams(location.search);
  const userId = query.get("user");

  const [data, setData] = useState<ResultDetail | null>(null);

  useEffect(() => {
    axios
      .get<ResultDetail>(`/api/dashboard/records/${resultId}/`)
      .then((res) => setData(res.data))
      .catch(() => setData(null));
  }, [resultId]);

  if (!data) {
    return (
      <div className="text-center mt-10 text-gray-500">
        데이터 불러오는 중...
      </div>
    );
  }

  const riskColor =
    data.risk_level === "높음"
      ? "text-red-600 bg-red-100 border-red-300"
      : data.risk_level === "중간"
      ? "text-yellow-600 bg-yellow-100 border-yellow-300"
      : "text-green-600 bg-green-100 border-green-300";

  return (
    <div className="w-full max-w-md mx-auto bg-gray-50 min-h-screen px-4 py-5">
      {/* 뒤로가기 버튼 */}
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-gray-600 mb-3 flex items-center gap-1 hover:text-black"
      >
        ← 뒤로가기
      </button>

      {/* 상단 경로 */}
      <p className="text-xs text-gray-500 mb-2">
        {data.user.name} &gt; {data.photo.folder_name} &gt; {data.disease.name_ko}
      </p>

      {/* 경고 문구 */}
      {data.followup_check?.doctor_risk_level === "즉시 주의" && (
        <div className="bg-red-100 border border-red-400 text-red-600 rounded-md p-3 text-sm mb-4 font-semibold">
          ⚠️ 주의: 전문의의 소견 **[즉시 주의]** 상태입니다.
        </div>
      )}

      {/* AI 예측 결과 */}
      <div className="bg-white p-3 rounded-xl shadow-sm mb-4">
        <h3 className="text-sm font-semibold mb-2">AI 예측 진단 및 이미지 분석</h3>
        <div className="flex justify-around mb-2">
          <button className="text-xs text-blue-600 font-semibold border-b-2 border-blue-500">
            원본 환부 이미지
          </button>
          <button className="text-xs text-gray-500">AI GradCAM 분석</button>
        </div>
        <div className="w-full bg-gray-100 rounded-md overflow-hidden text-center">
          <img
            src={`/${data.photo.upload_storage_path}`}
            alt="original"
            className="w-full h-auto"
          />
        </div>
      </div>

      {/* 질환명 및 위험도 */}
      <div className="bg-white p-3 rounded-xl shadow-sm mb-4">
        <p className="text-xs text-blue-600 font-semibold mb-1">AI 예측 진단명</p>
        <p className="font-bold text-lg">
          {data.disease.name_en} ({data.disease.name_ko})
        </p>
        <p className={`text-xs mt-2 ${riskColor}`}>
          AI 위험도: {data.risk_level}
        </p>
      </div>

      {/* 전문의 최종 소견 */}
      <div className="bg-red-50 border border-red-300 rounded-xl p-3 shadow-sm mb-4">
        <p className="text-sm font-bold text-red-600 mb-1">전문의 최종 소견</p>
        <p className="text-xs mb-1">
          {data.followup_check?.doctor_note || "소견이 등록되지 않았습니다."}
        </p>
        <p className="text-xs text-gray-500">
          최종 판정: {data.followup_check?.doctor_risk_level || "소견 대기"} / 업데이트일:{" "}
          {data.followup_check?.last_updated_at.split("T")[0] ||
            data.analysis_date.split("T")[0]}
        </p>
      </div>

      {/* VLM 모델 분석 */}
      <div className="bg-white p-3 rounded-xl shadow-sm mb-4">
        <p className="text-sm font-semibold mb-2">VLM 모델 분석 소견</p>
        <p className="text-xs text-gray-700 whitespace-pre-wrap">
          {data.vlm_analysis_text}
        </p>
      </div>

      {/* 환자 기본 정보 */}
      <div className="bg-white p-3 rounded-xl shadow-sm mb-4">
        <p className="text-sm font-semibold mb-2">환자 기본 정보</p>
        <p className="text-xs">
          나이 / 성별: {data.user.age}세 / {data.user.sex}
        </p>
        <p className="text-xs">환부 위치: {data.photo.body_part}</p>
        <p className="text-xs">가족력 유무: {data.user.family_history}</p>
      </div>

      {/* 주요 증상 및 특이사항 */}
      <div className="bg-white p-3 rounded-xl shadow-sm mb-4">
        <p className="text-sm font-semibold mb-2">주요 증상 및 특이사항</p>
        <p className="text-xs text-gray-700">
          발병 시점: {data.photo.onset_date}
        </p>
        <p className="text-xs text-gray-700">
          통증: {data.photo.symptoms_pain} / 색 변화: {data.photo.symptoms_color}
        </p>
      </div>
    </div>
  );
};

export default HistoryResultPage;
