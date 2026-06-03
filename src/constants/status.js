// Единый источник статусов карточки изображения.
// Все статусы задаются здесь, чтобы и хуки, и компоненты ссылались на одни и те же
// значения, а не на строковые литералы.
export const STATUS = {
  PROCESSED: 'Обработано',
  NOT_ANNOTATED: 'Не размечено',
  LOADING: 'Загружается',
  ERROR: 'Ошибка',
  UPLOADED_NO_TILES: 'Загружено (без тайлов)',
  PREPARING: 'Подготовка',
  DETECT_ERROR: 'Ошибка предразметки',
  PENDING_REVIEW: 'На проверке',
  TILES_BUILDING: 'Разбиение на тайлы',
  FINAL_ZIP_BUILDING: 'Формируется final.zip',
  FINAL_ZIP_READY: 'final.zip готов',
};
