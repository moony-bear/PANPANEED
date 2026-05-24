const OC_STORAGE_KEY = 'scs_oc_characters';

export type OCRelationType = '至交' | '爱慕' | '宿敌' | '利用' | '解救' | '血缘';

export interface OCRelation {
  targetName: string;
  relation: OCRelationType;
  detail?: string;
}

export interface OCCharacter {
  id: string;
  name: string;
  personality: string;
  socionicsType?: string;
  avatar?: string;
  relations?: OCRelation[];
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function normalizeRelation(raw: any): OCRelation | null {
  if (!raw || typeof raw !== 'object') return null;
  const targetName = typeof raw.targetName === 'string' ? raw.targetName.trim() : '';
  const relation = typeof raw.relation === 'string' ? raw.relation.trim() : '';
  if (!targetName || !relation) return null;

  const allowed: OCRelationType[] = ['至交', '爱慕', '宿敌', '利用', '解救', '血缘'];
  return {
    targetName,
    relation: allowed.includes(relation as OCRelationType) ? (relation as OCRelationType) : '至交',
    detail: typeof raw.detail === 'string' ? raw.detail.trim() : '',
  };
}

function normalizeOC(raw: any): OCCharacter | null {
  if (!raw || typeof raw !== 'object') return null;

  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!name) return null;

  return {
    id,
    name,
    personality: typeof raw.personality === 'string' ? raw.personality.trim() : '',
    socionicsType: typeof raw.socionicsType === 'string' && raw.socionicsType.trim() ? raw.socionicsType.trim().toUpperCase() : undefined,
    avatar: typeof raw.avatar === 'string' ? raw.avatar : '',
    relations: Array.isArray(raw.relations)
      ? raw.relations.map(normalizeRelation).filter((relation): relation is OCRelation => Boolean(relation))
      : [],
  };
}

function writeOCList(list: OCCharacter[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(OC_STORAGE_KEY, JSON.stringify(list));
}

export function getOCList(): OCCharacter[] {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(OC_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeOC).filter((character): character is OCCharacter => Boolean(character));
  } catch {
    return [];
  }
}

export function saveOC(character: OCCharacter): void {
  const normalized = normalizeOC(character);
  if (!normalized) return;

  const currentList = getOCList();
  const nextList = currentList.some((item) => item.id === normalized.id)
    ? currentList.map((item) => (item.id === normalized.id ? normalized : item))
    : [...currentList, normalized];
  writeOCList(nextList);
}

export function deleteOC(id: string): void {
  if (!id) return;
  writeOCList(getOCList().filter((item) => item.id !== id));
}

export function exportOCs(): void {
  if (typeof document === 'undefined') return;

  const payload = {
    exported_at: new Date().toISOString(),
    characters: getOCList(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `oc_characters_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function importOCs(file: File): Promise<boolean> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const rawCharacters = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.characters) ? parsed.characters : null;
    if (!rawCharacters) return false;

    const normalized = rawCharacters.map(normalizeOC).filter((character): character is OCCharacter => Boolean(character));
    if (normalized.length === 0) return false;

    const merged = new Map<string, OCCharacter>();
    [...getOCList(), ...normalized].forEach((character) => {
      merged.set(character.id, character);
    });

    writeOCList(Array.from(merged.values()));
    return true;
  } catch {
    return false;
  }
}
