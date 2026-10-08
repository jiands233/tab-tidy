export const DEFAULT_GROUPING_LANGUAGE = 'auto';
export const DEFAULT_GROUPING_DETAIL = 'detailed';
export const DEFAULT_GROUPING_STYLE = 'icon';
export const DEFAULT_GROUPING_PALETTE = 'minimal';

export const GROUPING_PALETTES = [
  { value: 'minimal', label: '克制双色 · 灰 + 蓝', colors: ['grey', 'blue'] },
  { value: 'cool', label: '冷色系 · 蓝 + 青 + 紫', colors: ['blue', 'cyan', 'purple'] },
  { value: 'single', label: '统一单色', colors: [] },
  { value: 'theme', label: '按主题配色', colors: [] },
];

export const GROUPING_COLORS = [
  { value: 'grey', label: '灰色', hex: '#5f6368' },
  { value: 'blue', label: '蓝色', hex: '#1a73e8' },
  { value: 'cyan', label: '青色', hex: '#00838f' },
  { value: 'purple', label: '紫色', hex: '#9334e6' },
  { value: 'green', label: '绿色', hex: '#188038' },
  { value: 'orange', label: '橙色', hex: '#fa903e' },
  { value: 'yellow', label: '黄色', hex: '#fbbc04' },
  { value: 'pink', label: '粉色', hex: '#d01884' },
  { value: 'red', label: '红色', hex: '#d93025' },
];

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
  { value: 'icon', label: 'Emoji + 主题（推荐）', example: '🤖 AI · 安全研究' },
];

const languageValues = new Set(GROUPING_LANGUAGES.map(({ value }) => value));
const detailValues = new Set(GROUPING_DETAILS.map(({ value }) => value));
const styleValues = new Set(GROUPING_STYLES.map(({ value }) => value));
const paletteValues = new Set(GROUPING_PALETTES.map(({ value }) => value));
const colorValues = new Set(GROUPING_COLORS.map(({ value }) => value));

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
    groupingPalette: paletteValues.has(values.groupingPalette)
      ? values.groupingPalette
      : DEFAULT_GROUPING_PALETTE,
    groupingColor: colorValues.has(values.groupingColor) ? values.groupingColor : 'blue',
  };
}
