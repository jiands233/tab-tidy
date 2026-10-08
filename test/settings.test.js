import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_GROUPING_DETAIL,
  DEFAULT_GROUPING_LANGUAGE,
  DEFAULT_GROUPING_STYLE,
  normalizeGroupingSettings,
} from '../src/settings.js';

test('uses detailed automatic naming for existing users without preferences', () => {
  assert.deepEqual(normalizeGroupingSettings(), {
    groupingLanguage: DEFAULT_GROUPING_LANGUAGE,
    groupingDetail: DEFAULT_GROUPING_DETAIL,
    groupingStyle: DEFAULT_GROUPING_STYLE,
  });
});

test('rejects unknown preference values instead of sending them to the model', () => {
  assert.deepEqual(normalizeGroupingSettings({ groupingLanguage: 'pirate', groupingDetail: 'random' }), {
    groupingLanguage: 'auto',
    groupingDetail: 'detailed',
    groupingStyle: 'hierarchical',
  });
});

test('preserves supported language, detail and naming style selections', () => {
  const selected = { groupingLanguage: 'zh-TW', groupingDetail: 'balanced', groupingStyle: 'icon' };
  assert.deepEqual(normalizeGroupingSettings(selected), selected);
});
