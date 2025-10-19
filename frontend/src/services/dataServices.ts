// frontend/src/services/dataService.ts

import axios from 'axios';

export const fetchDiagnosisRecords = async () => {
    console.log("Fetching diagnosis records (Mocked)");
    // const response = await axios.get('/dashboard/records/');
    // return response.data;
    return { records: [] };
};

export const uploadImage = async (imageFile: File) => {
    console.log("Uploading image for diagnosis (Mocked)");
    // const formData = new FormData();
    // formData.append('image', imageFile);
    // return axios.post('/diagnosis/upload/', formData);
    return { success: true };
};

// 파일명이 'data.Services.ts'가 아닌 'dataService.ts'인지 확인해 주세요.
// (캡처에서는 'auth.Services.ts', 'data.Services.ts'로 되어 있어 오타일 가능성이 있습니다.)