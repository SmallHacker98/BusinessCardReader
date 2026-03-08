import Dexie from 'dexie';

export const db = new Dexie('MeishiDB');

db.version(1).stores({
  contacts: '++id, name, companyName, department, email, phone, createdAt',
  companies: '++id, name, domain',
  company_relations: '++id, fromCompanyId, toCompanyId',
  news_cache: '++id, companyName, cachedAt',
  settings: 'key'
});

// 初回起動時にストレージ永続化をリクエスト
export const initStorage = async () => {
  if (navigator.storage && navigator.storage.persist) {
    const persistent = await navigator.storage.persist();
    console.log('Persistent storage:', persistent);
  }
};

export default db;
