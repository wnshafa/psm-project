import { collection, onSnapshot } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BORDER_RADIUS, COLORS, FONT_SIZE, SPACING } from '../src/constants/theme';
import { db } from '../src/lib/firebase';

export default function AdminClientList() {
  const [clients, setClients] = useState<any[]>([]);

  useEffect(() => {
    // Listen to users collection for the client list
    return onSnapshot(collection(db, 'users'), (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, []);

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput 
          style={styles.searchInput} 
          placeholder="Search clients..." 
          placeholderTextColor={COLORS.textSecondary}
        />
      </View>

      {/* Client Table Header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.headerCell, { flex: 2 }]}>Client Name</Text>
        <Text style={[styles.headerCell, { flex: 3 }]}>Email</Text>
        <Text style={[styles.headerCell, { flex: 1 }]}>Status</Text>
        <Text style={[styles.headerCell, { flex: 1 }]}>Actions</Text>
      </View>

      <ScrollView>
        {clients.map((client) => (
          <View key={client.id} style={styles.tableRow}>
            <Text style={[styles.cell, { flex: 2 }]}>{client.name || 'N/A'}</Text>
            <Text style={[styles.cell, { flex: 3 }]}>{client.email}</Text>
            <Text style={[styles.cell, { flex: 1, color: COLORS.success }]}>Active</Text>
            <Pressable style={styles.viewButton}>
              <Text style={styles.viewButtonText}>View</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: SPACING.md },
  
  searchContainer: { marginBottom: SPACING.xl },
  searchInput: { 
    borderWidth: 1, 
    borderColor: COLORS.border, 
    backgroundColor: COLORS.inputBackground,
    padding: SPACING.md, 
    borderRadius: BORDER_RADIUS.md,
    color: COLORS.textPrimary 
  },
  
  tableHeader: { 
    flexDirection: 'row', 
    backgroundColor: COLORS.card, 
    padding: SPACING.md, 
    borderBottomWidth: 1, 
    borderColor: COLORS.border 
  },
  headerCell: { 
    fontWeight: 'bold', 
    fontSize: FONT_SIZE.xs, 
    color: COLORS.textSecondary 
  },
  
  tableRow: { 
    flexDirection: 'row', 
    padding: SPACING.md, 
    borderBottomWidth: 1, 
    borderColor: COLORS.border, 
    alignItems: 'center' 
  },
  cell: { 
    fontSize: FONT_SIZE.sm, 
    color: COLORS.textPrimary 
  },
  
  viewButton: { 
    flex: 1, 
    borderWidth: 1, 
    borderColor: COLORS.primary, 
    padding: 5, 
    alignItems: 'center', 
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: 'transparent'
  },
  viewButtonText: { 
    fontSize: FONT_SIZE.xs, 
    color: COLORS.primary 
  }
});