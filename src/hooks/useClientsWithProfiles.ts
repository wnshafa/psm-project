import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';

export interface ClientProfile {
  id: string;
  name: string;
  fullName: string;
  email: string;
  pushToken: string | null;
  role?: string;
  skinType?: string;
  skinConcern?: string | string[];
  age?: string;
  streak?: number;
  totalCompleted?: number;
  dailyAdherence?: number;
  [key: string]: any;
}

export function useClientsWithProfiles(): { clients: ClientProfile[]; loading: boolean } {
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let allClients: any[] = [];
    let allUsers: any[] = [];

    const merge = () => {
      const merged: ClientProfile[] = allClients.map(client => {
        const user = allUsers.find(u => u.id === client.id);
        const fullName =
          user?.fullName || user?.name || client.fullName || client.name || client.email || 'Unnamed Client';
        return {
          ...client,
          id: client.id,
          name: fullName,
          fullName,
          email: user?.email || client.email || '',
          pushToken: user?.pushToken || client.pushToken || null,
          role: user?.role,
          skinType: user?.skinType || client.skinType,
          skinConcern: user?.skinConcern || client.skinConcern,
          age: user?.age || client.age,
        };
      });
      merged.sort((a, b) => a.fullName.localeCompare(b.fullName));
      setClients(merged);
      setLoading(false);
    };

    const unsubClients = onSnapshot(collection(db, 'clients'), snap => {
      allClients = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      merge();
    });

    const unsubUsers = onSnapshot(
      query(collection(db, 'users'), where('role', '!=', 'admin')),
      snap => {
        allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        merge();
      }
    );

    return () => {
      unsubClients();
      unsubUsers();
    };
  }, []);

  return { clients, loading };
}
