import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { useBaby } from "../../context/BabyContext";
import { supabase } from "../../lib/supabase";
import { generateMonthlyReportPDF } from "../../lib/pdfGenerator";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const { width } = Dimensions.get("window");

// CSS-based simple circular progress fallback
const CircularProgress = ({ percentage }: { percentage: number }) => {
  // We will just do a clean rounded container with a thick border for now
  // A true SVG pie wedge requires react-native-svg
  return (
    <View style={styles.circleContainer}>
      <View style={styles.circleOuter}>
        <View style={styles.circleInner}>
          <Text style={styles.circleText}>{percentage}%</Text>
        </View>
      </View>
    </View>
  );
};

export default function ProgressScreen() {
  const { user, loading: authLoading } = useAuth();
  const { selectedBaby, isSwitchingBaby } = useBaby();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [timeFrame, setTimeFrame] = useState<"week" | "month">("week");
  const [loadingData, setLoadingData] = useState(false);

  const [globalProgress, setGlobalProgress] = useState({
    completed: 0,
    total: 0,
  });
  const [areaProgress, setAreaProgress] = useState({
    Motor: { completed: 0, total: 0 },
    Lenguaje: { completed: 0, total: 0 },
    Cognitivo: { completed: 0, total: 0 },
    Social: { completed: 0, total: 0 },
  });
  const [exportLoading, setExportLoading] = useState(false);
  const [rawActivities, setRawActivities] = useState<any[]>([]);
  const [rawLogs, setRawLogs] = useState<any[]>([]);

  const fetchProgress = async () => {
    if (!selectedBaby) {
      setLoading(false);
      return;
    }
    setLoadingData(true);

    try {
      // Reset Progress Maps
      setAreaProgress({
        Motor: { completed: 0, total: 0 },
        Lenguaje: { completed: 0, total: 0 },
        Cognitivo: { completed: 0, total: 0 },
        Social: { completed: 0, total: 0 },
      });
      setGlobalProgress({ completed: 0, total: 0 });

      const offset = new Date().getTimezoneOffset();
      const now = new Date();

      let startStr = "";
      let endStr = "";

      if (timeFrame === "week") {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const startOfWeek = new Date(now);
        startOfWeek.setDate(diff);
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);

        startStr = new Date(startOfWeek.getTime() - offset * 60 * 1000)
          .toISOString()
          .split("T")[0];
        endStr = new Date(endOfWeek.getTime() - offset * 60 * 1000)
          .toISOString()
          .split("T")[0];
      } else {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        startStr = new Date(startOfMonth.getTime() - offset * 60 * 1000)
          .toISOString()
          .split("T")[0];
        endStr = new Date(endOfMonth.getTime() - offset * 60 * 1000)
          .toISOString()
          .split("T")[0];
      }

      const { data: planData } = await supabase
        .from("planned_activity")
        .select("activity_id, assigned_date")
        .eq("baby_id", selectedBaby.baby_id)
        .gte("assigned_date", startStr)
        .lte("assigned_date", endStr);

      if (planData && planData.length > 0) {
        const plannedIds = planData.map((p) => p.activity_id);
        const { data: activityData } = await supabase
          .from("activity")
          .select(`*, stimulation_area ( name ), age_range ( name )`)
          .in("activity_id", plannedIds);

        const { data: logData } = await supabase
          .from("activity_log")
          .select("activity_id")
          .eq("baby_id", selectedBaby.baby_id)
          .in("activity_id", plannedIds)
          .not("end_time", "is", null);

        if (activityData) {
          const logsSet = new Set(logData?.map((log) => log.activity_id) || []);
          let globalTotal = activityData.length;
          let globalCompleted = logsSet.size;

          const pMap = {
            Motor: { completed: 0, total: 0 },
            Lenguaje: { completed: 0, total: 0 },
            Cognitivo: { completed: 0, total: 0 },
            Social: { completed: 0, total: 0 },
          };

          activityData.forEach((act: any) => {
            const areaName =
              (act.stimulation_area as any)?.name?.toLowerCase() || "";
            const isCompleted = logsSet.has(act.activity_id);

            let targetArea = "Cognitivo";
            if (areaName.includes("motor")) targetArea = "Motor";
            if (
              areaName.includes("lenguaje") ||
              areaName.includes("language") ||
              areaName.includes("auditory")
            )
              targetArea = "Lenguaje";
            if (areaName.includes("social") || areaName.includes("emocional"))
              targetArea = "Social";
            if (areaName.includes("cognitiv") || areaName.includes("sensory"))
              targetArea = "Cognitivo";

            pMap[targetArea as keyof typeof pMap].total++;
            if (isCompleted) {
              pMap[targetArea as keyof typeof pMap].completed++;
            }
          });

          setGlobalProgress({ completed: globalCompleted, total: globalTotal });
          setAreaProgress(pMap);
          
          // Map activities with their assigned dates for the PDF
          const activitiesWithDates = activityData.map(act => {
            const plan = planData.find(p => p.activity_id === act.activity_id);
            return { ...act, assigned_date: plan?.assigned_date };
          });
          
          setRawActivities(activitiesWithDates);
          setRawLogs(logData || []);
        }
      }
    } catch (err) {
      console.error("Error fetching tab progress:", err);
    } finally {
      setLoadingData(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login' as any);
    }
  }, [user, authLoading]);

  useEffect(() => {
    if (selectedBaby) {
      fetchProgress();
    }
  }, [selectedBaby, timeFrame]);

  const renderLoading = () => (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#3b82f6" />
      {isSwitchingBaby && (
        <Text style={{ marginTop: 12, color: '#64748b', fontSize: 16 }}>Actualizando estadísticas...</Text>
      )}
    </View>
  );

  if (authLoading || loading || isSwitchingBaby) return renderLoading();

  if (!selectedBaby) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>
          Selecciona o registra un bebé en Inicio para ver su progreso.
        </Text>
      </View>
    );
  }

  const gPercentage =
    globalProgress.total > 0
      ? Math.round((globalProgress.completed / globalProgress.total) * 100)
      : 0;

  const getAreaPercentage = (
    areaKey: "Motor" | "Lenguaje" | "Cognitivo" | "Social",
  ) => {
    const areaStats = areaProgress[areaKey];
    if (areaStats.total === 0) return 0;
    return Math.round((areaStats.completed / areaStats.total) * 100);
  };

  const AREA_UI = {
    Motor: {
      bg: "#EFF6FF",
      barColor: "#3b82f6",
      icon: "run",
      title: "Motor",
      subtitle: "Movimiento y coordinación",
    },
    Lenguaje: {
      bg: "#F5F3FF",
      barColor: "#a855f7",
      icon: "account-voice",
      title: "Lenguaje",
      subtitle: "Habla y comunicación",
    },
    Cognitivo: {
      bg: "#ECFDF5",
      barColor: "#10b981",
      icon: "head-lightbulb-outline",
      title: "Cognitivo",
      subtitle: "Aprendizaje y pensamiento",
    },
    Social: {
      bg: "#FEF2F2",
      barColor: "#f43f5e",
      icon: "emoticon-happy-outline",
      title: "Socio-afectivo",
      subtitle: "Emociones y sociabilidad",
    },
  };

  const handleExportPDF = async () => {
    if (!selectedBaby || rawActivities.length === 0) return;
    setExportLoading(true);

    try {
      // Prepare stats for PDF
      const areas: any[] = Object.keys(areaProgress).map(key => {
        const k = key as keyof typeof areaProgress;
        const pct = areaProgress[k].total > 0 ? Math.round((areaProgress[k].completed / areaProgress[k].total) * 100) : 0;
        return {
          name: key === 'Social' ? 'Socio-afectivo' : key,
          completed: areaProgress[k].completed,
          total: areaProgress[k].total,
          percentage: pct,
          color: AREA_UI[k].barColor
        };
      });

      // Prepare activities for PDF
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const activityDetails = rawActivities.map(act => {
        const log = rawLogs.find(l => l.activity_id === act.activity_id);
        const areaName = (act.stimulation_area as any)?.name || 'General';
        
        let rating = 'Pendiente';
        if (log) {
          rating = log.performance_rating || 'Completada';
        } else if (act.assigned_date && act.assigned_date < todayStr) {
          rating = 'No realizada';
        }

        return {
          title: act.title,
          category: areaName,
          rating: rating,
          date: act.assigned_date ? format(new Date(act.assigned_date + 'T12:00:00'), 'd MMM', { locale: es }) : 'N/A'
        };
      });

      // Get age range from baby context or activities
      const rangeName = rawActivities[0]?.age_range?.name || 'Etapa Actual';

      await generateMonthlyReportPDF(
        {
          name: selectedBaby.name,
          age_range: rangeName,
          birth_date: selectedBaby.birth_date
        },
        areas,
        activityDetails,
        timeFrame
      );
    } catch (error) {
      console.error("Error exporting PDF:", error);
    } finally {
      setExportLoading(false);
    }
  };

  const renderAreaCard = (
    key: "Motor" | "Lenguaje" | "Cognitivo" | "Social",
  ) => {
    const ui = AREA_UI[key];
    const pct = getAreaPercentage(key);

    return (
      <TouchableOpacity
        style={styles.areaCard}
        activeOpacity={0.8}
        onPress={() =>
          router.push({
            pathname: "/area-activities-detail",
            params: { areaKey: key, timeFrame: timeFrame },
          })
        }
      >
        <View style={[styles.areaIconContainer, { backgroundColor: ui.bg }]}>
          <MaterialCommunityIcons
            name={ui.icon as any}
            size={28}
            color={ui.barColor}
          />
        </View>
        <View style={styles.areaInfo}>
          <View style={styles.areaRow}>
            <View>
              <Text style={styles.areaTitle}>{ui.title}</Text>
              <Text style={styles.areaSubtitle}>{ui.subtitle}</Text>
            </View>
            <Text style={styles.areaPercentageText}>{pct}%</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${pct}%`, backgroundColor: ui.barColor },
              ]}
            />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() =>
            router.canGoBack() ? router.back() : router.push("/(tabs)")
          }
          style={styles.headerIconBtn}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reporte de Progreso</Text>
        <TouchableOpacity 
          style={styles.headerIconBtn}
          onPress={handleExportPDF}
          disabled={exportLoading}
        >
          {exportLoading ? (
            <ActivityIndicator size="small" color="#3b82f6" />
          ) : (
            <MaterialCommunityIcons
              name="share-variant-outline"
              size={24}
              color="#3b82f6"
            />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Segmented Control */}
        <View style={styles.segmentContainer}>
          <TouchableOpacity
            style={[
              styles.segmentBtn,
              timeFrame === "week" && styles.segmentBtnActive,
            ]}
            onPress={() => setTimeFrame("week")}
          >
            <Text
              style={[
                styles.segmentText,
                timeFrame === "week" && styles.segmentTextActive,
              ]}
            >
              Esta Semana
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.segmentBtn,
              timeFrame === "month" && styles.segmentBtnActive,
            ]}
            onPress={() => setTimeFrame("month")}
          >
            <Text
              style={[
                styles.segmentText,
                timeFrame === "month" && styles.segmentTextActive,
              ]}
            >
              Este Mes
            </Text>
          </TouchableOpacity>
        </View>

        {/* Hero Circle Card */}
        <View style={styles.heroCard}>
          <CircularProgress percentage={gPercentage} />
          <Text style={styles.greatJobTitle}>
            {gPercentage >= 80
              ? "¡Excelente trabajo!"
              : gPercentage >= 50
                ? "¡Buen trabajo!"
                : "¡Empezando el plan!"}
          </Text>
          <Text style={styles.greatJobSubtitle}>
            El bebé va por buen camino.{"\n"}¡Sigue así!
          </Text>
          
          <TouchableOpacity 
            style={styles.exportButton} 
            onPress={handleExportPDF}
            disabled={exportLoading}
          >
            {exportLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <MaterialCommunityIcons name="file-pdf-box" size={20} color="#FFFFFF" />
                <Text style={styles.exportButtonText}>
                  Descargar Reporte {timeFrame === 'week' ? 'Semanal' : 'Mensual'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Stimulation Areas Header */}
        <View style={styles.areasHeaderRow}>
          <Text style={styles.areasHeaderTitle}>Áreas de Estimulación</Text>
          <TouchableOpacity onPress={() => { }}>
            <Text style={styles.viewAllText}>Ver Todo</Text>
          </TouchableOpacity>
        </View>

        {/* Area Cards */}
        {renderAreaCard("Motor")}
        {renderAreaCard("Lenguaje")}
        {renderAreaCard("Cognitivo")}
        {renderAreaCard("Social")}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F9FC",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F7F9FC",
  },
  emptyText: {
    color: "#64748b",
    fontSize: 16,
    paddingHorizontal: 40,
    textAlign: "center",
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 15,
    paddingTop: 10,
  },
  headerIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#e2e8f0",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#0f172a",
  },
  segmentContainer: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 30,
    padding: 4,
    marginBottom: 24,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 26,
    alignItems: "center",
  },
  segmentBtnActive: {
    backgroundColor: "#3b82f6",
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  segmentText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#64748b",
  },
  segmentTextActive: {
    color: "#FFFFFF",
  },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 30,
    padding: 30,
    alignItems: "center",
    marginBottom: 24,
    shadowColor: "#e2e8f0",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 4,
  },
  circleContainer: {
    width: 140,
    height: 140,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  circleOuter: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 12,
    borderColor: "#3b82f6",
    borderRightColor: "#e2e8f0", // Fake CSS semi-circle progress ring
    borderBottomColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
    transform: [{ rotate: "45deg" }],
  },
  circleInner: {
    transform: [{ rotate: "-45deg" }],
    justifyContent: "center",
    alignItems: "center",
  },
  circleText: {
    fontSize: 32,
    fontWeight: "900",
    color: "#0f172a",
  },
  greatJobTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 8,
  },
  greatJobSubtitle: {
    fontSize: 15,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 22,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    marginTop: 20,
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  exportButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 14,
  },
  areasHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  areasHeaderTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0f172a",
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3b82f6",
  },
  areaCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#e2e8f0",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 2,
  },
  areaIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  areaInfo: {
    flex: 1,
  },
  areaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  areaTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#0f172a",
  },
  areaSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  areaPercentageText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0f172a",
  },
  progressBarBg: {
    height: 8,
    backgroundColor: "#f1f5f9",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
  },
});
