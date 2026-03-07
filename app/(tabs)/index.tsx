import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Dimensions, Image, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

const { width } = Dimensions.get('window');

// Mapeo preciso de colores del diseño original para las tarjetas
const AREA_COLORS = {
  Motor: { bg: '#FFE4cc', text: '#5D4037', highlight: '#F57C00' }, // Naranja pastel
  Language: { bg: '#E4F4D0', text: '#33691E', highlight: '#558B2F' }, // Verde pastel
  Cognitive: { bg: '#E0F7FA', text: '#006064', highlight: '#00838F' }, // Cyan pastel
  Social: { bg: '#E8EAF6', text: '#283593', highlight: '#3949AB' }, // Morado pastel
};

export default function HomeScreen() {
  const { user, loading: authLoading } = useAuth();
  const [babies, setBabies] = useState<any[]>([]);
  const [tutorName, setTutorName] = useState<string>('Mom');
  const [loadingBabies, setLoadingBabies] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login' as any);
    }
  }, [user, authLoading]);

  const fetchData = async () => {
    setLoadingBabies(true);
    try {
      // 1. Fetch baby data
      const { data: babyData, error: babyError } = await supabase
        .from('baby')
        .select('*')
        .eq('tutor_id', user?.id)
        .order('created_at', { ascending: false });

      if (!babyError && babyData) {
        setBabies(babyData);
      }

      // 2. Fetch tutor data
      const { data: tutorData } = await supabase
        .from('tutor')
        .select('full_name')
        .eq('tutor_id', user?.id)
        .single();

      if (tutorData?.full_name) {
        // Obtener solo el primer nombre para una UI amigable si existe
        const firstName = tutorData.full_name.split(' ')[0];
        setTutorName(firstName);
      }

    } catch (err) {
      console.error('Error fetching data for home screen:', err);
    } finally {
      setLoadingBabies(false);
    }
  };

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  if (authLoading || loadingBabies) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (!user) return null;

  const currentBaby = babies.length > 0 ? babies[0] : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F9FB' }}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* TOP HEADER (Avatar + Welcome) */}
        <View style={styles.topHeader}>
          <View style={styles.profileRow}>
            <View style={styles.avatarContainer}>
              <Image
                source={require('../../assets/images/profile_baby.png')}
                style={styles.avatarImage}
                defaultSource={require('../../assets/images/profile_baby.png')}
              />
              <View style={styles.onlineBadge} />
            </View>
            <View style={styles.greetingBox}>
              <Text style={styles.goodMorning}>Buenos días,</Text>
              <Text style={styles.username}>
                {currentBaby ? `${currentBaby.name} & ${tutorName}` : `Hola, ${tutorName}`}
              </Text>
            </View>
          </View>

          <View style={styles.bellIcon} onTouchEnd={() => supabase.auth.signOut()}>
            <MaterialCommunityIcons name="logout" size={24} color="#ef4444" />
          </View>
        </View>

        {/* MAIN CARD: CURRENT MILESTONE */}
        {currentBaby ? (
          <View style={styles.mainCard}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.milestoneLabel}>HITO ACTUAL</Text>
              <View style={styles.monthBadge}>
                <Text style={styles.monthBadgeText}>6 Meses</Text>
              </View>
            </View>

            <Text style={styles.levelTitle}>Nivel 3: El Explorador</Text>

            <View style={styles.illustrationRow}>
              <Image
                source={require('../../assets/images/baby_activity.png')}
                style={styles.babyActivityImage}
                resizeMode="contain"
              />

              <View style={styles.nextStepBox}>
                <Text style={styles.nextStepLabel}>Próximo gran paso</Text>
                <Text style={styles.nextStepValue}>Sentarse sin ayuda</Text>
                <View style={styles.progressBarBg}>
                  <View style={styles.progressBarFill} />
                </View>
              </View>
            </View>

            <View
              style={styles.continueBtn}
              onTouchEnd={() => router.push({ pathname: '/activities-list', params: { baby_id: currentBaby.baby_id } })}
            >
              <Text style={styles.continueBtnText}>Continuar Evaluación</Text>
              <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
            </View>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.welcomeInfo}>No se encontró ningún perfil de bebé.</Text>
            <View
              style={[styles.continueBtn, { width: '80%', alignSelf: 'center' }]}
              onTouchEnd={() => router.push('/register-baby' as any)}
            >
              <Text style={styles.continueBtnText}>Registrar Bebé</Text>
            </View>
          </View>
        )}

        <View style={styles.devAreasHeader}>
          <Text style={styles.devAreasTitle}>Áreas de Desarrollo</Text>
          <Text style={styles.viewReportText}>Ver Reporte</Text>
        </View>

        <View style={styles.devGrid}>
          {/* Card 1: Motor Skills */}
          <View style={[styles.devCard, { backgroundColor: AREA_COLORS.Motor.bg }]}>
            <View style={styles.devCardHeader}>
              <View style={[styles.devIconWrapper, { backgroundColor: '#FFDDC1' }]}>
                <MaterialCommunityIcons name="run" size={24} color={AREA_COLORS.Motor.highlight} />
              </View>
              <Text style={[styles.devPercentage, { color: AREA_COLORS.Motor.text }]}>75%</Text>
            </View>
            <Text style={[styles.devCardTitle, { color: AREA_COLORS.Motor.text }]}>Motor</Text>
            <Text style={[styles.devCardSubtitle, { color: AREA_COLORS.Motor.highlight }]}>Motricidad Gruesa</Text>
          </View>

          {/* Card 2: Language */}
          <View style={[styles.devCard, { backgroundColor: AREA_COLORS.Language.bg }]}>
            <View style={styles.devCardHeader}>
              <View style={[styles.devIconWrapper, { backgroundColor: '#F0F9E8' }]}>
                <MaterialCommunityIcons name="chart-bar" size={24} color={AREA_COLORS.Language.highlight} />
              </View>
              <Text style={[styles.devPercentage, { color: AREA_COLORS.Language.text }]}>40%</Text>
            </View>
            <Text style={[styles.devCardTitle, { color: AREA_COLORS.Language.text }]}>Lenguaje</Text>
            <Text style={[styles.devCardSubtitle, { color: AREA_COLORS.Language.highlight }]}>Balbuceo</Text>
          </View>

          {/* Card 3: Cognitive */}
          <View style={[styles.devCard, { backgroundColor: AREA_COLORS.Cognitive.bg }]}>
            <View style={styles.devCardHeader}>
              <View style={[styles.devIconWrapper, { backgroundColor: '#E0F7FA' }]}>
                <MaterialCommunityIcons name="head-lightbulb-outline" size={24} color={AREA_COLORS.Cognitive.highlight} />
              </View>
              <Text style={[styles.devPercentage, { color: AREA_COLORS.Cognitive.text }]}>60%</Text>
            </View>
            <Text style={[styles.devCardTitle, { color: AREA_COLORS.Cognitive.text }]}>Cognitivo</Text>
            <Text style={[styles.devCardSubtitle, { color: AREA_COLORS.Cognitive.highlight }]}>Resolución</Text>
          </View>

          {/* Card 4: Social */}
          <View style={[styles.devCard, { backgroundColor: AREA_COLORS.Social.bg }]}>
            <View style={styles.devCardHeader}>
              <View style={[styles.devIconWrapper, { backgroundColor: '#FFFFFF' }]}>
                <MaterialCommunityIcons name="heart" size={24} color={AREA_COLORS.Social.highlight} />
              </View>
              <Text style={[styles.devPercentage, { color: AREA_COLORS.Social.text }]}>90%</Text>
            </View>
            <Text style={[styles.devCardTitle, { color: AREA_COLORS.Social.text }]}>Social</Text>
            <Text style={[styles.devCardSubtitle, { color: AREA_COLORS.Social.highlight }]}>Vínculo</Text>
          </View>
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
    paddingBottom: 110
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
    width: '55%',
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
  }
});