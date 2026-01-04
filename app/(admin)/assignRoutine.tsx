import { Picker } from '@react-native-picker/picker';
import { addDoc, collection, doc, onSnapshot, Timestamp } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { BORDER_RADIUS, COLORS, FONT_SIZE, SPACING } from '../src/constants/theme';
import { db } from '../src/lib/firebase';

export default function AssignRoutine() {
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [steps, setSteps] = useState([{ title: '', instructions: '' }]);

  useEffect(() => {
    return onSnapshot(collection(db, 'users'), (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, []);

  const addStep = () => {
    setSteps([...steps, { title: '', instructions: '' }]);
  };

  const handleAssign = async () => {
    if (!selectedClient) return Alert.alert("Error", "Please select a client.");
    try {
      await addDoc(collection(db, 'routines'), {
        clientID: doc(db, 'clients', selectedClient),
        assignedDate: Timestamp.now(),
        description: "Custom assigned routine",
        steps: steps
      });
      Alert.alert("Success", "Routine assigned to client.");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Client Selection Section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Select Client</Text>
      </View>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={selectedClient}
          onValueChange={(itemValue) => setSelectedClient(itemValue)}
          dropdownIconColor={COLORS.primary}
        >
          <Picker.Item label="Choose a client..." value="" color={COLORS.textSecondary} />
          {clients.map(c => <Picker.Item key={c.id} label={c.email} value={c.id} />)}
        </Picker>
      </View>

      {/* Routine Steps Section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Routine Steps</Text>
      </View>
      
      {steps.map((step, index) => (
        <View key={index} style={styles.stepCard}>
          <Text style={styles.stepLabel}>Step {index + 1}</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Cleanser"
            placeholderTextColor={COLORS.textSecondary}
            value={step.title}
            onChangeText={(text) => {
              const newSteps = [...steps];
              newSteps[index].title = text;
              setSteps(newSteps);
            }}
          />
          <Text style={styles.stepLabel}>Instructions</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Enter instructions..."
            placeholderTextColor={COLORS.textSecondary}
            multiline
            value={step.instructions}
            onChangeText={(text) => {
              const newSteps = [...steps];
              newSteps[index].instructions = text;
              setSteps(newSteps);
            }}
          />
        </View>
      ))}

      {/* Action Buttons */}
      <Pressable style={styles.addStepBtn} onPress={addStep}>
        <Text style={styles.addStepText}>+ Add Another Step</Text>
      </Pressable>

      <Pressable style={styles.assignBtn} onPress={handleAssign}>
        <Text style={styles.assignBtnText}>Assign Routine</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: COLORS.background, 
    padding: SPACING.md 
  },
  sectionHeader: {
    marginBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: SPACING.xs,
  },
  sectionTitle: { 
    fontSize: FONT_SIZE.md, 
    fontWeight: '700', 
    color: COLORS.textPrimary 
  },
  pickerContainer: { 
    backgroundColor: COLORS.card,
    borderWidth: 1, 
    borderColor: COLORS.border, 
    borderRadius: BORDER_RADIUS.md, 
    marginBottom: SPACING.xl,
    overflow: 'hidden'
  },
  stepCard: { 
    padding: SPACING.md, 
    backgroundColor: COLORS.card, 
    borderWidth: 1, 
    borderColor: COLORS.border, 
    borderRadius: BORDER_RADIUS.lg, 
    marginBottom: SPACING.md,
    // Optional shadow for consistent card look
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  stepLabel: { 
    fontSize: FONT_SIZE.xs, 
    color: COLORS.textSecondary, 
    marginBottom: SPACING.xs, 
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  input: { 
    borderWidth: 1, 
    borderColor: COLORS.border, 
    padding: SPACING.sm, 
    borderRadius: BORDER_RADIUS.md, 
    marginBottom: SPACING.md, 
    backgroundColor: COLORS.inputBackground,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.sm
  },
  textArea: { 
    height: 100, 
    textAlignVertical: 'top' 
  },
  addStepBtn: { 
    padding: SPACING.md, 
    alignItems: 'center', 
    marginBottom: SPACING.xl 
  },
  addStepText: { 
    color: COLORS.primary, 
    fontWeight: '700',
    fontSize: FONT_SIZE.sm 
  },
  assignBtn: { 
    backgroundColor: COLORS.primary, 
    padding: SPACING.lg, 
    borderRadius: BORDER_RADIUS.md, 
    alignItems: 'center', 
    marginBottom: SPACING.xxl 
  },
  assignBtnText: { 
    color: '#fff', 
    fontWeight: 'bold',
    fontSize: FONT_SIZE.md 
  }
});