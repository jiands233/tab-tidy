export const DEFAULT_GROUPING_LANGUAGE = 'auto';
export const DEFAULT_GROUPING_DETAIL = 'detailed';
export const DEFAULT_GROUPING_STYLE = 'hierarchical';

export const GROUPING_LANGUAGES = [
  { value: 'auto', label: '自动跟随内容' },
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
  { value: 'es', label: 'Español' },
];

export const GROUPING_DETAILS = [
  { value: 'balanced', label: '平衡：主题清晰，分组适中' },
  { value: 'detailed', label: '细致：优先拆分具体任务' },
];

export const GROUPING_STYLES = [
  { value: 'concise', label: '简短主题', example: 'AI 安全研究' },
  { value: 'hierarchical', label: '主题 · 子主题', example: 'AI · 安全研究' },
  { value: 'icon', label: '图标主题', example: '🤖 AI · 安全研究' },
];

const languageValues = new Set(GROUPING_LANGUAGES.map(({ value }) => value));
const detailValues = new Set(GROUPING_DETAILS.map(({ value }) => value));
const styleValues = new Set(GROUPING_STYLES.map(({ value }) => value));

export function normalizeGroupingSettings(values = {}) {
  return {
    groupingLanguage: languageValues.has(values.groupingLanguage)
      ? values.groupingLanguage
      : DEFAULT_GROUPING_LANGUAGE,
    groupingDetail: detailValues.has(values.groupingDetail)
      ? values.groupingDetail
      : DEFAULT_GROUPING_DETAIL,
    groupingStyle: styleValues.has(values.groupingStyle)
      ? values.groupingStyle
      : DEFAULT_GROUPING_STYLE,
  };
}
