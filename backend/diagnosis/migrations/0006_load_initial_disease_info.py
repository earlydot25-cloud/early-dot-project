# Generated manually for initial disease info data

from django.db import migrations


def load_disease_info(apps, schema_editor):
    """8개 질병 정보 초기 데이터 로드"""
    DiseaseInfo = apps.get_model('diagnosis', 'DiseaseInfo')
    
    diseases_data = [
        {
            'name_ko': '흑색종',
            'name_en': 'Melanoma',
            'classification': '악성',
            'description': '가장 위험한 피부암 중 하나입니다. 피부의 멜라닌 세포에서 발생하며 전이가 빠릅니다.',
            'recommendation': '즉시 병원 방문을 권장합니다. 조기 발견 시 치료 예후가 좋습니다.',
        },
        {
            'name_ko': '모반',
            'name_en': 'Nevus',
            'classification': '양성',
            'description': '일반적인 점으로, 큰 문제가 없습니다. 대부분 양성이나 변화가 있으면 주의가 필요합니다.',
            'recommendation': '정기적인 관찰을 권장합니다. 크기, 색상, 형태 변화 시 병원 방문하세요.',
        },
        {
            'name_ko': '기저세포암',
            'name_en': 'Basal Cell Carcinoma',
            'classification': '악성',
            'description': '일반적으로 천천히 성장하는 피부암입니다. 가장 흔한 피부암이지만 전이는 드뭅니다.',
            'recommendation': '의사 상담 후 치료를 받으세요. 조기 치료 시 완치 가능성이 높습니다.',
        },
        {
            'name_ko': '편평세포암',
            'name_en': 'Squamous Cell Carcinoma',
            'classification': '악성',
            'description': '표피의 편평세포에서 발생하는 암입니다. 기저세포암보다 빠르게 성장하고 전이 위험이 있습니다.',
            'recommendation': '정기적인 검진을 권장합니다. 빠른 치료가 필요합니다.',
        },
        {
            'name_ko': '피부섬유종',
            'name_en': 'Dermatofibroma',
            'classification': '양성',
            'description': '피부의 섬유 조직에서 발생하는 양성 종양입니다. 통증이 없으며 대부분 치료가 필요하지 않습니다.',
            'recommendation': '정기적인 관찰을 권장합니다. 불편함이 있을 경우 제거 수술을 고려할 수 있습니다.',
        },
        {
            'name_ko': '양성 각화증',
            'name_en': 'Benign Keratosis',
            'classification': '양성',
            'description': '피부의 각질층이 비정상적으로 두꺼워진 양성 질환입니다. 지루각화증이라고도 하며 노화와 관련이 있습니다.',
            'recommendation': '정기적인 관찰을 권장합니다. 미용상 문제가 있을 경우 제거 가능합니다.',
        },
        {
            'name_ko': '광선 각화증',
            'name_en': 'Actinic Keratosis',
            'classification': '전암성',
            'description': '햇빛 노출로 인한 전암성 병변으로, 피부암(편평세포암)으로 발전할 수 있습니다. 조기 치료가 중요합니다.',
            'recommendation': '즉시 병원 방문을 권장합니다. 냉동치료, 크림 치료 등 다양한 치료법이 있습니다.',
        },
        {
            'name_ko': '혈관종',
            'name_en': 'Vascular',
            'classification': '양성',
            'description': '혈관 관련 피부 병변입니다. 혈관이 비정상적으로 증식하여 발생하며 대부분 양성입니다.',
            'recommendation': '정기적인 관찰을 권장합니다. 크기가 커지거나 출혈이 있으면 병원 방문하세요.',
        },
    ]
    
    # get_or_create로 중복 방지
    for data in diseases_data:
        disease, created = DiseaseInfo.objects.get_or_create(
            name_ko=data['name_ko'],
            defaults={
                'name_en': data['name_en'],
                'classification': data['classification'],
                'description': data['description'],
                'recommendation': data['recommendation'],
            }
        )
        if created:
            print(f"✅ 질병 정보 생성: {disease.name_ko}")
        else:
            print(f"ℹ️ 질병 정보 이미 존재: {disease.name_ko}")


def reverse_load_disease_info(apps, schema_editor):
    """역방향 마이그레이션: 생성된 질병 정보 삭제"""
    DiseaseInfo = apps.get_model('diagnosis', 'DiseaseInfo')
    
    # 특정 질병만 삭제 (사용자가 추가한 커스텀 질병은 유지)
    disease_names = [
        '흑색종', '모반', '기저세포암', '편평세포암',
        '피부섬유종', '양성 각화증', '광선 각화증', '혈관종'
    ]
    
    DiseaseInfo.objects.filter(name_ko__in=disease_names).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('diagnosis', '0005_alter_results_grad_cam_path'),
    ]

    operations = [
        migrations.RunPython(load_disease_info, reverse_load_disease_info),
    ]

