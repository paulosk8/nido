import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Dimensions, Image, Modal, ActivityIndicator as RNActivityIndicator, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useBaby } from '../../context/BabyContext';
import { calculateBabyAges } from '../../lib/babyLogic';
import { supabase } from '../../lib/supabase';
import { ensureWeeklyPlanExists } from '../../lib/weeklyPlanner';
import * as ImagePicker from 'expo-image-picker';
const { decode } = require('base-64');
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

// Mapeo preciso de colores del diseño original para las tarjetas
const AREA_COLORS = {
  Motor: { bg: '#FFE4cc', text: '#5D4037', highlight: '#F57C00' }, // Naranja pastel
  Language: { bg: '#E4F4D0', text: '#33691E', highlight: '#558B2F' }, // Verde pastel
  Cognitive: { bg: '#E0F7FA', text: '#006064', highlight: '#00838F' }, // Cyan pastel
  Social: { bg: '#E8EAF6', text: '#283593', highlight: '#3949AB' }, // Morado pastel
};

const getExactAgeString = (birthDateString: string) => {
  const start = new Date(birthDateString);
  const end = new Date();

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();

  if (days < 0) {
    months--;
    const previousMonth = new Date(end.getFullYear(), end.getMonth(), 0);
    days += previousMonth.getDate();
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  let result = '';
  if (years > 0) result += `${years} año${years > 1 ? 's' : ''}, `;
  if (months > 0) result += `${months} mes${months > 1 ? 'es' : ''}, `;
  if (days > 0 || result === '') result += `${days} día${days !== 1 ? 's' : ''}`;

  // Clean up trailing comma
  if (result.endsWith(', ')) result = result.substring(0, result.length - 2);
  return result;
};

export default function HomeScreen() {
  const { user, loading: authLoading } = useAuth();
  const { babies, selectedBaby, setSelectedBaby, loadingBabies, isSwitchingBaby, refreshBabies } = useBaby();
  const router = useRouter();

  const [tutorName, setTutorName] = useState('Tutor');
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [showBabySelector, setShowBabySelector] = useState(false);
  const [showBabyDetailsModal, setShowBabyDetailsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editTutorName, setEditTutorName] = useState('');
  const [editBabyName, setEditBabyName] = useState('');
  const [editBabyGender, setEditBabyGender] = useState<'M' | 'F' | 'O'>('O');
  const [editBabyImage, setEditBabyImage] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // MILESTONE MODALS
  const [showBirthdayModal, setShowBirthdayModal] = useState(false);
  const [showRangeUpgradeModal, setShowRangeUpgradeModal] = useState(false);
  const [newRangeName, setNewRangeName] = useState('');

  const [dailyProgress, setDailyProgress] = useState({ completed: 0, total: 0 });
  const [weeklyAreaProgress, setWeeklyAreaProgress] = useState({
    Motor: { completed: 0, total: 0 },
    Lenguaje: { completed: 0, total: 0 },
    Cognitivo: { completed: 0, total: 0 },
    Social: { completed: 0, total: 0 }
  });


  const fetchProgressAndTutor = async () => {
    if (!user) return;
    setLoadingProgress(true);
    try {
      // 1. Fetch tutor data
      const { data: tutorData } = await supabase
        .from('tutor')
        .select('full_name')
        .eq('tutor_id', user?.id)
        .single();

      if (tutorData?.full_name) {
        const firstName = tutorData.full_name.split(' ')[0];
        setTutorName(firstName);
      }

      // 2. Fetch progress for selected baby
      if (selectedBaby) {
        setWeeklyAreaProgress({ Motor: { completed: 0, total: 0 }, Lenguaje: { completed: 0, total: 0 }, Cognitivo: { completed: 0, total: 0 }, Social: { completed: 0, total: 0 } });
        setDailyProgress({ completed: 0, total: 0 });

        const { cronological, corrected, isPremature } = calculateBabyAges(
          selectedBaby.birth_date,
          selectedBaby.weeks_gestation || 40
        );
        const targetAgeInMonths = Math.floor(isPremature ? corrected : cronological);

        // Get range for baby
        let { data: rangeData } = await supabase
          .from('age_range')
          .select('range_id, name')
          .lte('min_months', targetAgeInMonths)
          .gte('max_months', targetAgeInMonths)
          .limit(1);

        if (!rangeData || rangeData.length === 0) {
          const { data: fallbackRange } = await supabase
            .from('age_range')
            .select('range_id, name')
            .order('min_months', { ascending: true })
            .limit(1);
          rangeData = fallbackRange;
        }

        if (rangeData && rangeData.length > 0) {
          const activeRangeId = rangeData[0].range_id;
          const rangeName = rangeData[0].name || 'Nueva Etapa';

          await ensureWeeklyPlanExists(selectedBaby.baby_id, activeRangeId, isPremature);

          const offset = new Date().getTimezoneOffset();
          const now = new Date();
          const todayStr = new Date(now.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];

          // --- MILESTONES CHECK ---
          // 1. Birthday Check
          if (selectedBaby.birth_date && todayStr.substring(5, 10) === selectedBaby.birth_date.substring(5, 10)) {
            const currentYear = todayStr.split('-')[0];
            const bdKey = `@bd_celebrated_${selectedBaby.baby_id}_${currentYear}`;
            const celebrated = await AsyncStorage.getItem(bdKey);
            if (!celebrated) {
              setShowBirthdayModal(true);
              await AsyncStorage.setItem(bdKey, 'true');
            }
          }

          // 2. Range Upgrade Check
          const lastRangeKey = `@last_range_${selectedBaby.baby_id}`;
          const lastRangeId = await AsyncStorage.getItem(lastRangeKey);
          
          if (lastRangeId && lastRangeId !== activeRangeId) {
             setNewRangeName(rangeName);
             setShowRangeUpgradeModal(true);
          }
          if (lastRangeId !== activeRangeId) {
             await AsyncStorage.setItem(lastRangeKey, activeRangeId);
          }
          // ------------------------

          const startOfWeek = new Date(now);
          const day = startOfWeek.getDay();
          const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
          startOfWeek.setDate(diff);
          startOfWeek.setHours(0, 0, 0, 0);

          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(endOfWeek.getDate() + 6);

          const startStr = new Date(startOfWeek.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];
          const endStr = new Date(endOfWeek.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];

          const { data: planData } = await supabase
            .from('planned_activity')
            .select('activity_id, assigned_date')
            .eq('baby_id', selectedBaby.baby_id)
            .gte('assigned_date', startStr)
            .lte('assigned_date', endStr);

          if (planData && planData.length > 0) {
            const plannedIds = planData.map(p => p.activity_id);
            const { data: activityData } = await supabase
              .from('activity')
              .select(`*, stimulation_area ( name )`)
              .in('activity_id', plannedIds);

            const { data: logData } = await supabase
              .from('activity_log')
              .select('activity_id')
              .eq('baby_id', selectedBaby.baby_id)
              .in('activity_id', plannedIds)
              .not('end_time', 'is', null);

            if (activityData) {
              const logsSet = new Set(logData?.map(log => log.activity_id) || []);

              let dailyTotal = 0;
              let dailyCompleted = 0;

              const progressMap = { Motor: { completed: 0, total: 0 }, Lenguaje: { completed: 0, total: 0 }, Cognitivo: { completed: 0, total: 0 }, Social: { completed: 0, total: 0 } };

              activityData.forEach(act => {
                const planMatch = planData.find(p => p.activity_id === act.activity_id);
                const isCompleted = logsSet.has(act.activity_id);
                const isForToday = planMatch && planMatch.assigned_date === todayStr;

                // DAILY PROGRESS (For Hero Card)
                if (isForToday) {
                  dailyTotal++;
                  if (isCompleted) dailyCompleted++;
                }

                // WEEKLY PROGRESS PER AREA (For Bottom Cards)
                const areaName = (act.stimulation_area as any)?.name?.toLowerCase() || '';
                let targetArea = 'Cognitivo';
                if (areaName.includes('motor')) targetArea = 'Motor';
                if (areaName.includes('lenguaje') || areaName.includes('language') || areaName.includes('auditory')) targetArea = 'Lenguaje';
                if (areaName.includes('social') || areaName.includes('emocional')) targetArea = 'Social';
                if (areaName.includes('cognitiv') || areaName.includes('sensory')) targetArea = 'Cognitivo';

                progressMap[targetArea as keyof typeof progressMap].total++;
                if (isCompleted) {
                  progressMap[targetArea as keyof typeof progressMap].completed++;
                }
              });

              setDailyProgress({ completed: dailyCompleted, total: dailyTotal });
              setWeeklyAreaProgress(progressMap);
            }
          }
        }
      } else {
        // Clear progress if no baby
        setDailyProgress({ completed: 0, total: 0 });
        setWeeklyAreaProgress({ Motor: { completed: 0, total: 0 }, Lenguaje: { completed: 0, total: 0 }, Cognitivo: { completed: 0, total: 0 }, Social: { completed: 0, total: 0 } });
      }
    } catch (err) {
      console.error('Error fetching progress for home screen:', err);
    } finally {
      setLoadingProgress(false);
    }
  };

  useEffect(() => {
    if (user && !loadingBabies) {
      fetchProgressAndTutor();
    }
  }, [user, selectedBaby, loadingBabies, isSwitchingBaby]);

  const handleEditProfile = () => {
    setEditTutorName(tutorName);
    setEditBabyName(selectedBaby ? selectedBaby.name : '');
    setEditBabyGender(selectedBaby?.gender as 'M' | 'F' | 'O' || 'O');
    setEditBabyImage(null); // Reset pending image upload
    setShowSettingsModal(true);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Necesitamos permisos para acceder a tu galería');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0].uri) {
      setEditBabyImage(result.assets[0].uri);
    }
  };

  const handleSaveSettings = async () => {
    if (!user || savingSettings) return;
    setSavingSettings(true);

    try {
      // Update Tutor
      if (editTutorName && editTutorName !== tutorName) {
        const { error: tError } = await supabase
          .from('tutor')
          .update({ full_name: editTutorName })
          .eq('tutor_id', user.id);
        if (!tError) {
          setTutorName(editTutorName.split(' ')[0]);
        }
      }

      // Update Baby
      if (selectedBaby) {
        let uploadedImageUrl = undefined; // undefined keeps it out of update object if null

        // 1. Subir nueva foto si se seleccionó una
        if (editBabyImage) {
          try {
            // Android compat: use ArrayBuffer instead of Blob from fetch
            const base64 = await FileSystem.readAsStringAsync(editBabyImage, { encoding: 'base64' });
            const arrayBuffer = new Uint8Array(decode(base64).split('').map((c: string) => c.charCodeAt(0))).buffer;
            const filePath = `babies/${user?.id}/${new Date().getTime()}.jpg`;

            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('avatars')
              .upload(filePath, arrayBuffer, { contentType: 'image/jpeg' });

            if (uploadError) {
              console.error('Error uploading image in settings:', uploadError);
            } else if (uploadData) {
              const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
              uploadedImageUrl = urlData.publicUrl;
            }
          } catch (err) {
            console.error('Failed processing image blob:', err);
          }
        }

        // 2. Actualizar registro en DB
        const babyUpdates: any = {};
        if (editBabyName && editBabyName !== selectedBaby.name) babyUpdates.name = editBabyName;
        if (editBabyGender !== selectedBaby.gender) babyUpdates.gender = editBabyGender;
        if (uploadedImageUrl) babyUpdates.profile_image_url = `${uploadedImageUrl}?v=${Date.now()}`;

        if (Object.keys(babyUpdates).length > 0) {
          const { error: bError } = await supabase
            .from('baby')
            .update(babyUpdates)
            .eq('baby_id', selectedBaby.baby_id);

          if (!bError) {
            // Optimistic UI update and refresh to ensure everything syncs well
            setSelectedBaby({ ...selectedBaby, ...babyUpdates });
            await refreshBabies();
          }
        }
      }

      setShowSettingsModal(false);
    } catch (error) {
      Alert.alert('Error', 'No se pudieron guardar los cambios.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDeleteBaby = () => {
    if (!selectedBaby) return;
    Alert.alert(
      "Eliminar Perfil de Bebé",
      "⚠️ ¡Atención! Esta acción es irreversible.\nSe eliminará permanentemente perfil, nombre y TODO el progreso registrado en Nido. ¿Estás seguro/a de que deseas eliminar este perfil?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Sí, Eliminar", 
          style: "destructive",
          onPress: async () => {
            setSavingSettings(true);
            try {
              const { error } = await supabase.from('baby').delete().eq('baby_id', selectedBaby.baby_id);
              if (!error) {
                setShowSettingsModal(false);
                refreshBabies();
              } else {
                Alert.alert("Error", "No se pudo eliminar el perfil en este momento.");
              }
            } catch (err) {
              console.error(err);
              Alert.alert('Error', 'Hubo un inconveniente al conectar con el servidor.');
            } finally {
              setSavingSettings(false);
            }
          }
        }
      ]
    );
  };

  if (authLoading || loadingBabies || loadingProgress || isSwitchingBaby) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
        {isSwitchingBaby && (
          <Text style={{ marginTop: 12, color: '#64748b', fontSize: 16 }}>Calculando plan de {selectedBaby?.name}...</Text>
        )}
      </View>
    );
  }

  if (!user) return null;

  // Percentages Calculation
  const dailyPercentage = dailyProgress.total > 0 ? Math.round((dailyProgress.completed / dailyProgress.total) * 100) : 0;

  const getWeeklyAreaPercentage = (areaKey: 'Motor' | 'Lenguaje' | 'Cognitivo' | 'Social') => {
    const areaStats = weeklyAreaProgress[areaKey];
    if (areaStats.total === 0) return 0;
    return Math.round((areaStats.completed / areaStats.total) * 100);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F9FB' }}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* TOP HEADER (Avatar + Welcome) */}
        <View style={styles.topHeader}>
          <View style={[styles.profileRow, { padding: 0 }]}>
            <TouchableOpacity style={styles.avatarContainer} onPress={() => setShowBabyDetailsModal(true)}>
              <Image
                source={selectedBaby?.profile_image_url ? { uri: selectedBaby.profile_image_url } : require('../../assets/images/profile_baby.png')}
                style={styles.avatarImage}
                defaultSource={require('../../assets/images/profile_baby.png')}
              />
              <View style={styles.onlineBadge} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.greetingBox} onPress={() => setShowBabySelector(true)}>
              <Text style={styles.goodMorning}>Buenos días,</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.username}>
                  {selectedBaby ? `${selectedBaby.name} & ${tutorName}` : `Hola, ${tutorName}`}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={24} color="#0f172a" style={{ marginTop: 2, marginLeft: 4 }} />
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity onPress={handleEditProfile} style={[styles.iconButton, { marginLeft: 10 }]}>
              <MaterialCommunityIcons name="cog" size={26} color="#0f172a" />
            </TouchableOpacity>
          </View>
        </View>

        {/* SETTINGS MODAL */}
        <Modal visible={showSettingsModal} transparent={true} animationType="fade" onRequestClose={() => setShowSettingsModal(false)}>
          <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowSettingsModal(false)} activeOpacity={1}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Ajustes de Perfil</Text>

              <View style={{ width: '100%', marginBottom: 16 }}>
                <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 6, fontWeight: 'bold', marginLeft: 4 }}>Tu Nombre (Tutor)</Text>
                <TextInput
                  style={styles.settingsInput}
                  value={editTutorName}
                  onChangeText={setEditTutorName}
                  placeholder="Nombre del Tutor"
                />
              </View>

              {selectedBaby && (
                <View style={{ width: '100%', marginBottom: 24 }}>
                  <View style={{ alignItems: 'center', marginBottom: 16 }}>
                    <TouchableOpacity onPress={pickImage} activeOpacity={0.8}>
                      <Image
                        source={editBabyImage ? { uri: editBabyImage } : (selectedBaby?.profile_image_url ? { uri: selectedBaby.profile_image_url } : require('../../assets/images/profile_baby.png'))}
                        style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: '#3b82f6' }}
                      />
                      <View style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: '#3b82f6', borderRadius: 12, padding: 4 }}>
                        <MaterialCommunityIcons name="camera" size={16} color="#ffffff" />
                      </View>
                    </TouchableOpacity>
                    <Text style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Cambiar foto</Text>
                  </View>

                  <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 6, fontWeight: 'bold', marginLeft: 4 }}>Nombre del Bebé</Text>
                  <TextInput
                    style={styles.settingsInput}
                    value={editBabyName}
                    onChangeText={setEditBabyName}
                    placeholder="Nombre del Bebé"
                  />

                  <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 6, marginTop: 12, fontWeight: 'bold', marginLeft: 4 }}>Género</Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity 
                      style={[styles.genderBtn, editBabyGender === 'M' && styles.genderBtnActive]} 
                      onPress={() => setEditBabyGender('M')}
                    >
                      <Text style={[styles.genderText, editBabyGender === 'M' && styles.genderTextActive]}>Niño</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.genderBtn, editBabyGender === 'F' && styles.genderBtnActive]} 
                      onPress={() => setEditBabyGender('F')}
                    >
                      <Text style={[styles.genderText, editBabyGender === 'F' && styles.genderTextActive]}>Niña</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <TouchableOpacity style={styles.continueBtn} onPress={handleSaveSettings} disabled={savingSettings}>
                {savingSettings ? (
                  <RNActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.continueBtnText}>Guardar Cambios</Text>
                )}
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>
                {selectedBaby && (
                  <TouchableOpacity
                    style={{ padding: 10, flex: 1, alignItems: 'center' }}
                    onPress={handleDeleteBaby}
                    disabled={savingSettings}
                  >
                    <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>Eliminar Bebé</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={{ padding: 10, flex: 1, alignItems: 'center' }}
                  onPress={() => {
                    setShowSettingsModal(false);
                    supabase.auth.signOut();
                  }}
                >
                  <Text style={{ color: '#64748b', fontWeight: 'bold' }}>Cerrar Sesión</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* BIRTHDAY MODAL */}
        <Modal visible={showBirthdayModal} transparent={true} animationType="fade" onRequestClose={() => setShowBirthdayModal(false)}>
          <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowBirthdayModal(false)} activeOpacity={1}>
            <View style={[styles.modalContent, { alignItems: 'center', padding: 30 }]}>
              <MaterialCommunityIcons name="cake-variant" size={64} color="#f43f5e" style={{ marginBottom: 16 }} />
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#0f172a', textAlign: 'center', marginBottom: 12 }}>
                ¡Feliz Cumpleaños, {selectedBaby?.name}! 🎉
              </Text>
              <Text style={{ fontSize: 16, color: '#64748b', textAlign: 'center', marginBottom: 24, lineHeight: 24 }}>
                Felicidades por todo el esfuerzo y amor que dedicas a su desarrollo. ¡Disfruten mucho este día tan especial!
              </Text>
              <TouchableOpacity
                style={[styles.continueBtn, { width: '100%', backgroundColor: '#f43f5e' }]}
                onPress={() => setShowBirthdayModal(false)}
              >
                <Text style={styles.continueBtnText}>¡A Celebrar!</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* RANGE UPGRADE MODAL */}
        <Modal visible={showRangeUpgradeModal} transparent={true} animationType="slide" onRequestClose={() => setShowRangeUpgradeModal(false)}>
          <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowRangeUpgradeModal(false)} activeOpacity={1}>
            <View style={[styles.modalContent, { alignItems: 'center', padding: 30 }]}>
              <MaterialCommunityIcons name="star-shooting" size={64} color="#f59e0b" style={{ marginBottom: 16 }} />
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#0f172a', textAlign: 'center', marginBottom: 12 }}>
                ¡Nueva Etapa Alcanzada! 🌟
              </Text>
              <Text style={{ fontSize: 16, color: '#64748b', textAlign: 'center', marginBottom: 24, lineHeight: 24 }}>
                {selectedBaby?.name} ha crecido y acaba de entrar a la etapa: "{newRangeName}". Las nuevas actividades se reflejarán en tu próxima actualización de plan semanal. ¡Felicidades por este gran avance!
              </Text>
              <TouchableOpacity
                style={[styles.continueBtn, { width: '100%', backgroundColor: '#f59e0b' }]}
                onPress={() => setShowRangeUpgradeModal(false)}
              >
                <Text style={styles.continueBtnText}>¡Genial!</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* BABY DETAILS MODAL */}
        {selectedBaby && (
          <Modal visible={showBabyDetailsModal} transparent={true} animationType="fade" onRequestClose={() => setShowBabyDetailsModal(false)}>
            <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowBabyDetailsModal(false)} activeOpacity={1}>
              <View style={styles.modalContent}>
                <View style={{ alignItems: 'center', marginBottom: 16 }}>
                  <Image
                    source={selectedBaby?.profile_image_url ? { uri: selectedBaby.profile_image_url } : require('../../assets/images/profile_baby.png')}
                    style={{ width: 80, height: 80, borderRadius: 40, marginBottom: 12 }}
                  />
                  <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#0f172a' }}>{selectedBaby.name}</Text>
                  <Text style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>
                    Edad: {Math.floor(calculateBabyAges(selectedBaby.birth_date, selectedBaby.weeks_gestation || 40).cronological)} meses
                  </Text>
                </View>

                <View style={{ backgroundColor: '#f8fafc', padding: 16, borderRadius: 12, width: '100%', marginBottom: 20 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                    <Text style={{ fontSize: 14, color: '#64748b', fontWeight: '500' }}>Nacimiento</Text>
                    <Text style={{ fontSize: 14, color: '#0f172a', fontWeight: 'bold' }}>{selectedBaby.birth_date}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                    <Text style={{ fontSize: 14, color: '#64748b', fontWeight: '500' }}>Edad Exacta</Text>
                    <Text style={{ fontSize: 14, color: '#0f172a', fontWeight: 'bold' }}>{getExactAgeString(selectedBaby.birth_date)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 14, color: '#64748b', fontWeight: '500' }}>¿Prematuro?</Text>
                    <Text style={{ fontSize: 14, color: '#0f172a', fontWeight: 'bold' }}>{selectedBaby.is_premature ? 'Sí' : 'No'}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.continueBtn, { width: '100%', marginTop: 0 }]}
                  onPress={() => setShowBabyDetailsModal(false)}
                >
                  <Text style={styles.continueBtnText}>Cerrar Detalles</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
        )}

        {/* BABY SELECTOR MODAL */}
        <Modal visible={showBabySelector} transparent={true} animationType="fade" onRequestClose={() => setShowBabySelector(false)}>
          <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowBabySelector(false)} activeOpacity={1}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Seleccionar Bebé</Text>
              {babies.map((baby) => (
                <TouchableOpacity
                  key={baby.baby_id}
                  style={[styles.babyOption, selectedBaby?.baby_id === baby.baby_id && styles.babyOptionSelected]}
                  onPress={() => {
                    setSelectedBaby(baby);
                    setShowBabySelector(false);
                  }}
                >
                  <MaterialCommunityIcons name="face-man-profile" size={24} color={selectedBaby?.baby_id === baby.baby_id ? '#3b82f6' : '#64748b'} />
                  <Text style={[styles.babyOptionText, selectedBaby?.baby_id === baby.baby_id && { color: '#3b82f6', fontWeight: 'bold' }]}>
                    {baby.name}
                  </Text>
                  {selectedBaby?.baby_id === baby.baby_id && <MaterialCommunityIcons name="check" size={20} color="#3b82f6" />}
                </TouchableOpacity>
              ))}

              {babies.length < 2 && (
                <TouchableOpacity
                  style={styles.addBabyOption}
                  onPress={() => {
                    setShowBabySelector(false);
                    router.push('/register-baby' as any);
                  }}
                >
                  <MaterialCommunityIcons name="plus-circle-outline" size={24} color="#10b981" />
                  <Text style={styles.addBabyText}>Registrar otro bebé</Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* MAIN CARD: DAILY PLAN */}
        {selectedBaby ? (
          <View style={styles.mainCard}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.milestoneLabel}>PLAN DIARIO 🚀</Text>
              <View style={styles.monthBadge}>
                <Text style={styles.monthBadgeText}>{dailyProgress.completed}/{dailyProgress.total} Actividades Hoy</Text>
              </View>
            </View>

            <Text style={styles.levelTitle}>Progreso de Hoy</Text>

            {dailyProgress.total > 0 ? (
              <>
                <View style={styles.illustrationRow}>
                  <Image
                    source={require('../../assets/images/baby_activity.png')}
                    style={styles.babyActivityImage}
                    resizeMode="contain"
                  />

                  <View style={styles.nextStepBox}>
                    <Text style={styles.nextStepLabel}>Competado</Text>
                    <Text style={styles.nextStepValue}>{dailyPercentage}%</Text>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${dailyPercentage}%` }]} />
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.continueBtn}
                  onPress={() => router.push({ pathname: '/daily-plan', params: { baby_id: selectedBaby.baby_id } })}
                  activeOpacity={0.8}
                >
                  <Text style={styles.continueBtnText}>Ver Actividades de Hoy</Text>
                  <MaterialCommunityIcons name="calendar-check" size={20} color="#fff" />
                </TouchableOpacity>
              </>
            ) : (
              <View style={{ alignItems: 'center', marginVertical: 20 }}>
                <MaterialCommunityIcons name="sleep" size={60} color="#94a3b8" />
                <Text style={{ fontSize: 18, color: '#0f172a', fontWeight: 'bold', marginTop: 12 }}>¡Día de Descanso!</Text>
                <Text style={{ fontSize: 14, color: '#64748b', textAlign: 'center', marginTop: 8, paddingHorizontal: 20 }}>
                  Hoy no hay actividades programadas. Es importante dejar que tu bebé asimile lo aprendido y descanse.
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.welcomeInfo}>No se encontró ningún perfil de bebé.</Text>
            <TouchableOpacity
              style={[styles.continueBtn, { width: '80%', alignSelf: 'center' }]}
              onPress={() => router.push('/register-baby' as any)}
              activeOpacity={0.8}
            >
              <Text style={styles.continueBtnText}>Registrar Bebé</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.devAreasHeader}>
          <Text style={styles.devAreasTitle}>Resumen Semanal por Área</Text>
        </View>

        <View style={styles.devGrid}>
          {[
            { key: 'Motor', title: 'Motor', icon: 'run', colors: AREA_COLORS.Motor, paramId: 'Motor' },
            { key: 'Lenguaje', title: 'Lenguaje', icon: 'chart-bar', colors: AREA_COLORS.Language, paramId: 'Lenguaje' },
            { key: 'Cognitivo', title: 'Cognitivo', icon: 'head-lightbulb-outline', colors: AREA_COLORS.Cognitive, paramId: 'Cognitivo' },
            { key: 'Social', title: 'Social', icon: 'heart', colors: AREA_COLORS.Social, paramId: 'Social' }
          ].map((area) => {
            const pct = getWeeklyAreaPercentage(area.key as any);
            const totalWeeklyActs = weeklyAreaProgress[area.key as keyof typeof weeklyAreaProgress].total;
            const completedWeeklyActs = weeklyAreaProgress[area.key as keyof typeof weeklyAreaProgress].completed;
            const hasWeeklyPlan = totalWeeklyActs > 0;

            const bgColor = hasWeeklyPlan ? area.colors.bg : '#F1F5F9';
            const iconBg = hasWeeklyPlan ? `${area.colors.bg}80` : '#E2E8F0';
            const iconColor = hasWeeklyPlan ? area.colors.highlight : '#94A3B8';
            const textColor = hasWeeklyPlan ? area.colors.text : '#94A3B8';
            const subtitleText = hasWeeklyPlan ? `${completedWeeklyActs}/${totalWeeklyActs} semanal` : 'Sin plan';

            return (
              <TouchableOpacity
                key={area.key}
                style={[styles.devCard, { backgroundColor: bgColor }]}
                onPress={() => {
                  if (selectedBaby && hasWeeklyPlan) {
                    router.push({ pathname: '/area-report', params: { baby_id: selectedBaby.baby_id, area: area.paramId } });
                  }
                }}
                activeOpacity={hasWeeklyPlan ? 0.7 : 1}
              >
                <View style={styles.devCardHeader}>
                  <View style={[styles.devIconWrapper, { backgroundColor: iconBg }]}>
                    <MaterialCommunityIcons name={area.icon as any} size={24} color={iconColor} />
                  </View>
                  <Text style={[styles.devPercentage, { color: textColor }]}>
                    {hasWeeklyPlan ? `${pct}%` : '-'}
                  </Text>
                </View>
                <Text style={[styles.devCardTitle, { color: textColor }]}>{area.title}</Text>
                <Text style={[styles.devCardSubtitle, { color: hasWeeklyPlan ? area.colors.highlight : textColor }]}>{subtitleText}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#F8F9FB',
    paddingBottom: 20
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FB'
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 10
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  avatarContainer: {
    marginRight: 12,
    position: 'relative'
  },
  avatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#e2e8f0',
    borderWidth: 2,
    borderColor: '#ffffff'
  },
  onlineBadge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4ade80',
    position: 'absolute',
    bottom: 2,
    right: 2,
    borderWidth: 2,
    borderColor: '#ffffff'
  },
  greetingBox: {
    justifyContent: 'center'
  },
  goodMorning: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2
  },
  username: {
    fontWeight: '800',
    color: '#0f172a',
    fontSize: 22,
    letterSpacing: -0.5
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F8F9FB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bellIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Main Card
  mainCard: {
    backgroundColor: '#ffffff',
    borderRadius: 36,
    padding: 24,
    marginBottom: 30,
    shadowColor: '#e2e8f0',
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 3
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  milestoneLabel: {
    color: '#3b82f6',
    fontWeight: 'bold',
    fontSize: 12,
    letterSpacing: 1
  },
  monthBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16
  },
  monthBadgeText: {
    color: '#3b82f6',
    fontWeight: 'bold',
    fontSize: 13
  },
  levelTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 24,
    letterSpacing: -0.5
  },

  illustrationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24
  },
  babyActivityImage: {
    width: 130,
    height: 130,
    marginRight: 16,
  },
  nextStepBox: {
    flex: 1,
    justifyContent: 'center'
  },
  nextStepLabel: {
    color: '#64748b',
    fontSize: 15,
    marginBottom: 4,
    fontWeight: '500'
  },
  nextStepValue: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12
  },
  progressBarBg: {
    height: 10,
    backgroundColor: '#f1f5f9',
    borderRadius: 5,
    overflow: 'hidden',
    width: '100%'
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 5
  },
  continueBtn: {
    backgroundColor: '#438FFF',
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    width: '100%'
  },
  continueBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8
  },
  emptyState: {
    backgroundColor: '#ffffff',
    padding: 30,
    borderRadius: 36,
    alignItems: 'center',
    marginBottom: 30
  },
  welcomeInfo: {
    color: '#64748b',
    marginBottom: 20,
    textAlign: 'center',
    fontSize: 16
  },

  // Development Areas Headers
  devAreasHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
    paddingHorizontal: 4
  },
  devAreasTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a'
  },
  viewReportText: {
    color: '#3b82f6',
    fontWeight: 'bold',
    fontSize: 15
  },

  // 2x2 Grid specific styles
  devGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },
  devCard: {
    width: (width - 40 - 15) / 2, // Accounting for paddings and spacing
    borderRadius: 24,
    padding: 20,
    marginBottom: 15
  },
  devCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24
  },
  devIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center'
  },
  devPercentage: {
    fontSize: 22,
    fontWeight: '900'
  },
  devCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4
  },
  devCardSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.8
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalContent: {
    width: '85%',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 5
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 20,
    textAlign: 'center'
  },
  babyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  babyOptionSelected: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe'
  },
  babyOptionText: {
    flex: 1,
    fontSize: 16,
    marginLeft: 12,
    color: '#475569',
    fontWeight: '500'
  },
  addBabyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginTop: 8,
    borderRadius: 16,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0'
  },
  addBabyText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#059669'
  },
  settingsInput: {
    width: '100%',
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  genderBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  genderBtnActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  genderText: {
    marginLeft: 8,
    fontSize: 15,
    fontWeight: 'bold',
    color: '#64748b',
  },
  genderTextActive: {
    color: '#ffffff',
  }
});