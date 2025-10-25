export async function uploadCase(form: any, file: Blob) {
  const formData = new FormData();

  Object.entries(form).forEach(([key, value]) => {
    formData.append(key, String(value));
  });

//   formData.append('image', file, `${form.fileName || 'photo'}.jpg`);
    formData.append('upload_storage_path',file,`${form.file_name || form.fileName || 'photo'}.jpg`);
  const token = localStorage.getItem('accessToken'); // 로그인 때 받은 JWT라고 가정
  // ✅ 백엔드 서버(8000)로 직접 보내고
  // ✅ 슬래시(/)까지 포함합니다.
  const response = await fetch('http://localhost:8000/api/diagnosis/upload/', {
   method: 'POST',
   headers: {
     Authorization: token ? `Bearer ${token}` : '',
   },
   body: formData,
});

  if (!response.ok) {
    console.error('response status:', response.status);
    const errText = await response.text().catch(() => '');
    console.error('response body:', errText);
    throw new Error('업로드 실패');
  }

  return response.json();
}
