import { useState, useEffect, useCallback } from 'react';
import db from '../db/database';
import { photoStorage } from '../storage/photoStorage';

export const useContacts = (searchQuery = '') => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let all = await db.contacts.orderBy('createdAt').reverse().toArray();
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        all = all.filter(c =>
          c.name?.toLowerCase().includes(q) ||
          c.companyName?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.department?.toLowerCase().includes(q)
        );
      }
      setContacts(all);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => { load(); }, [load]);

  const saveContact = async (data, photoBlob) => {
    const id = data.id || crypto.randomUUID();
    let photoRef = data.photoRef || null;
    let photoStorage_ = data.photoStorageType || null;

    if (photoBlob) {
      const result = await photoStorage.save(id, photoBlob);
      photoRef = result.ref;
      photoStorage_ = result.storage;
    }

    const contact = {
      ...data,
      id,
      photoRef,
      photoStorageType: photoStorage_,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (data.id) {
      await db.contacts.put(contact);
    } else {
      await db.contacts.add(contact);
    }

    // 企業テーブルに自動登録
    if (contact.companyName) {
      const existing = await db.companies.where('name').equals(contact.companyName).first();
      if (!existing) {
        await db.companies.add({ name: contact.companyName, domain: '', newsKeywords: [] });
      }
    }

    await load();
    return contact;
  };

  const deleteContact = async (id, photoRef, photoStorageType) => {
    if (photoRef) {
      await photoStorage.delete(photoRef, photoStorageType);
    }
    await db.contacts.delete(id);
    await load();
  };

  const getContact = async (id) => {
    return await db.contacts.get(id);
  };

  return { contacts, loading, saveContact, deleteContact, getContact, reload: load };
};
