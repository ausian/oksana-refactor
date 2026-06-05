// Единый источник статусов карточки изображения.
// Все статусы задаются здесь, чтобы и хуки, и компоненты ссылались на одни и те же
// значения, а не на строковые литералы.
export const STATUS = {
  PROCESSED: 'Обработано',
  NOT_ANNOTATED: 'Не размечено',
  LOADING: 'Загружается',
  ERROR: 'Ошибка',
  PENDING_REVIEW: 'На проверке',
  TILES_BUILDING: 'Разбиение на тайлы',
  FINAL_ZIP_BUILDING: 'Добавление в датасет',
  ADDED_TO_DATASET: 'Добавлен в датасет',
  UPLOADED_NO_TILES: 'Загружено (без тайлов)',
  DETECT_ERROR: 'Ошибка предразметки',
};

// Возвращает цвет тега Ant Design для статуса карточки.
export const getStatusColor = (status) => {
  switch (status) {
    case STATUS.PROCESSED:          return 'green';
    case STATUS.NOT_ANNOTATED:      return 'red';
    case STATUS.LOADING:            return 'blue';
    case STATUS.ERROR:              return 'volcano';
    case STATUS.DETECT_ERROR:       return 'volcano';
    case STATUS.PENDING_REVIEW:     return 'orange';
    case STATUS.TILES_BUILDING:     return 'processing';
    case STATUS.FINAL_ZIP_BUILDING: return 'processing';
    case STATUS.ADDED_TO_DATASET:   return 'purple';
    default:                        return 'default';
  }
};
