// src/ocStorage.ts
export interface OCRelation {
    targetName: string;
    relation: '至交' | '爱慕' | '宿敌' | '利用' | '解救' | '血缘'; // 可自定义类型
    detail?: string; // 补充说明
}

export interface OCCharacter {
    id: string; // 唯一标识，用时间戳生成
    name: string;
    personality: string; // 性格描述
    socionicsType?: string; // 自测的SCS类型，如 ILI
    avatar: string; // Base64 编码的头像图片
    relations: OCRelation[]; 
}

const STORAGE_KEY = 'scs_oc_characters';

// 获取所有OC
export const getOCList = (): OCCharacter[] => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
};

// 保存/更新单个OC
export const saveOC = (oc: OCCharacter): void => {
    const list = getOCList();
    const index = list.findIndex(item => item.id === oc.id);
    if (index >= 0) list[index] = oc;
    else list.push(oc);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
};

// 删除OC
export const deleteOC = (id: string): void => {
    const list = getOCList().filter(item => item.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
};

// 导出为JSON文件
export const exportOCs = () => {
    const data = JSON.stringify(getOCList(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scs_oc_backup.json';
    a.click();
    URL.revokeObjectURL(url);
};

// 从JSON文件导入（需配合文件选择框）
export const importOCs = (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const list = JSON.parse(content) as OCCharacter[];
                // 简单验证格式后覆盖存储
                if (Array.isArray(list)) {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
                    resolve(true);
                } else resolve(false);
            } catch { resolve(false); }
        };
        reader.readAsText(file);
    });
};
