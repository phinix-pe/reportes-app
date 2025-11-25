import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Platform,
  UIManager,
  KeyboardAvoidingView,
  Modal,
} from "react-native";

import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Truck,
  User,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  ChevronDown,
  ChevronUp,
  Activity,
  ClipboardCheck,
  CloudOff,
  Sun,
  Moon,
  Sunset,
} from "lucide-react-native";

// const API_URL = "http://localhost:8080/api/reports";
const API_URL = "https://scooptram-backend-v1.rj.r.appspot.com/api/reports";
// const API_URL = "https://3cckzgsl-8080.brs.devtunnels.ms/api/reports";

// Habilitar animaciones para Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- Tipos ---
type ChecklistItem = {
  id: string;
  label: string;
  subLabel?: string;
};

type Category = {
  id: string;
  title: string;
  icon: React.ReactNode;
  items: ChecklistItem[];
};

type InspectionState = {
  [itemId: string]: "ok" | "fail" | null;
};

type ObservationsState = {
  [categoryId: string]: string;
};

// --- Datos ---
const CHECKLIST_DATA: Category[] = [
  {
    id: "pre-start",
    title: "1. Antes de Arrancar",
    icon: <Truck size={24} color="#2563EB" />,
    items: [
      { id: "p1", label: "Verificar niveles de aceite" },
      { id: "p2", label: "Llenar tanque de combustible" },
      { id: "p3", label: "Limpieza de enfriadores" },
      {
        id: "p4",
        label: "Limpieza de filtros de aire",
        subLabel: "Estado de indicador de restricción",
      },
      {
        id: "p5",
        label: "Chequear presión y desgaste de llantas",
        subLabel: "Incluye ajuste de tuercas",
      },
      { id: "p6", label: "Estado de articulación central" },
      { id: "p7", label: "Estado de lampón y cantoneras" },
      {
        id: "p8",
        label: "Lubricar puntos de articulación",
        subLabel: "Rodamientos y chumaceras",
      },
      { id: "p9", label: "Verificar alternador, fajas y poleas" },
      { id: "p10", label: "Bornes y electrolito de baterías" },
      { id: "p11", label: "Barra de seguridad articulación central" },
      { id: "p12", label: "Condiciones del extintor" },
    ],
  },
  {
    id: "running",
    title: "2. Después de Arrancar",
    icon: <Activity size={24} color="#EA580C" />,
    items: [
      {
        id: "r1",
        label: "Presión de transmisión",
        subLabel: "Rango: 240 a 280 PSI",
      },
      {
        id: "r2",
        label: "Temperatura de convertidor",
        subLabel: "Rango: 180 a 250 °F",
      },
      {
        id: "r3",
        label: "Presión de sistema de Frenos",
        subLabel: "Rango: 1200 a 1500 PSI",
      },
      { id: "r4", label: "Presión de aceite de motor" },
      { id: "r5", label: "Nivel y presión aceite transmisión" },
      { id: "r6", label: "Operatividad freno de servicio" },
      { id: "r7", label: "Selector de marcha, levante y volteo" },
      { id: "r8", label: "Verificar freno de emergencia" },
      { id: "r9", label: "Luces, claxon y alarma retroceso" },
      { id: "r10", label: "Estado de catalizador (PTX)" },
    ],
  },
  {
    id: "end-shift",
    title: "3. Al Final del Turno",
    icon: <Clock size={24} color="#9333EA" />,
    items: [
      { id: "e1", label: "Tacos de madera para llantas" },
      { id: "e2", label: "Reportar fugas de aceite" },
      { id: "e3", label: "Estacionar en lugar seguro" },
      { id: "e4", label: "Aplicar freno parqueo y apagar" },
      { id: "e5", label: "Señalizar con conos de seguridad" },
    ],
  },
];

const SHIFTS = ["Dia", "Tarde", "Noche"];

export default function App() {
  const [operator, setOperator] = useState("");
  const [shift, setShift] = useState("Dia");
  const [hourMeterStart, setHourMeterStart] = useState("");
  const [hourMeterEnd, setHourMeterEnd] = useState("");

  const [inspection, setInspection] = useState<InspectionState>({});
  const [observations, setObservations] = useState<ObservationsState>({});

  const [activeSection, setActiveSection] = useState<string | null>(
    "pre-start"
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Estado para el Modal de Turno
  const [showShiftPicker, setShowShiftPicker] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);

  // --- CORRECCIÓN SCROLL: Usamos un ref simple para guardar coordenadas Y ---
  const categoryYPositions = useRef<{ [key: string]: number }>({});

  const handleNumericInput = (text: string, setter: (val: string) => void) => {
    let correctedText = text.replace(/,/g, ".");
    correctedText = correctedText.replace(/[^0-9.]/g, "");
    const parts = correctedText.split(".");
    if (parts.length > 2) {
      correctedText = parts[0] + "." + parts.slice(1).join("");
    }
    setter(correctedText);
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const savedName = await AsyncStorage.getItem("scooptram_operator_pref");
        const savedDraft = await AsyncStorage.getItem("scooptram_draft_v2");

        if (savedDraft) {
          const parsed = JSON.parse(savedDraft);
          setOperator(parsed.operator || savedName || "");
          setShift(parsed.shift || "Dia");
          setHourMeterStart(parsed.hourMeterStart || "");
          setHourMeterEnd(parsed.hourMeterEnd || "");
          setInspection(parsed.inspection || {});
          setObservations(parsed.observations || {});
        } else if (savedName) {
          setOperator(savedName);
        }
      } catch (e) {
        console.error("Error cargando datos", e);
      } finally {
        setIsLoaded(true);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    const saveData = async () => {
      if (!isLoaded) return;

      try {
        if (operator) {
          await AsyncStorage.setItem("scooptram_operator_pref", operator);
        }
        const dataToSave = {
          operator,
          shift,
          hourMeterStart,
          hourMeterEnd,
          inspection,
          observations,
          lastUpdated: new Date().toISOString(),
        };
        await AsyncStorage.setItem(
          "scooptram_draft_v2",
          JSON.stringify(dataToSave)
        );
      } catch (e) {
        console.error("Error guardando datos", e);
      }
    };
    saveData();
  }, [
    operator,
    shift,
    hourMeterStart,
    hourMeterEnd,
    inspection,
    observations,
    isLoaded,
  ]);

  const getTotalChecklistItems = () =>
    CHECKLIST_DATA.reduce((acc, cat) => acc + cat.items.length, 0);
  const getCheckedItemsCount = () =>
    Object.values(inspection).filter((v) => v !== null).length;

  const checkFormCompletion = () => {
    const isOperatorFilled = operator.trim().length > 0;
    const isStartFilled = hourMeterStart.trim().length > 0;
    const isEndFilled = hourMeterEnd.trim().length > 0;
    const areAllChecksDone =
      getCheckedItemsCount() === getTotalChecklistItems();

    const totalSteps = getTotalChecklistItems() + 3;
    const stepsDone =
      getCheckedItemsCount() +
      (isOperatorFilled ? 1 : 0) +
      (isStartFilled ? 1 : 0) +
      (isEndFilled ? 1 : 0);

    return {
      isComplete:
        isOperatorFilled && isStartFilled && isEndFilled && areAllChecksDone,
      progressPercent: Math.round((stepsDone / totalSteps) * 100),
    };
  };

  const { isComplete, progressPercent } = checkFormCompletion();

  const toggleItem = (itemId: string, status: "ok" | "fail") => {
    setInspection((prev) => ({
      ...prev,
      [itemId]: prev[itemId] === status ? null : status,
    }));
  };

  // --- Lógica de Scroll Compatible Web/Native ---
  const toggleSection = (sectionId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const isOpening = activeSection !== sectionId;
    setActiveSection(isOpening ? sectionId : null);

    if (isOpening) {
      // Esperamos 150ms a que el layout se estabilice (cierre de otros items)
      setTimeout(() => {
        const yPosition = categoryYPositions.current[sectionId];

        if (yPosition !== undefined && scrollViewRef.current) {
          scrollViewRef.current.scrollTo({
            y: yPosition - 10, // Un poco de margen arriba
            animated: true,
          });
        }
      }, 150);
    }
  };

  const handleSubmit = async () => {
    if (!isComplete) return;
    setIsSubmitting(true);

    const payload = {
      operator,
      shift,
      hourMeterStart,
      hourMeterEnd,
      inspection,
      observations,
    };
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        Alert.alert(
          "¡Éxito!",
          "Reporte guardado y sincronizado correctamente."
        );
        await AsyncStorage.removeItem("scooptram_draft_v2");
        setInspection({});
        setObservations({});
        setHourMeterStart("");
        setHourMeterEnd("");
      } else {
        Alert.alert("Error", "No se pudo guardar el reporte en el servidor.");
        console.error(result);
      }
    } catch (error) {
      console.error("Error de red:", error);
      Alert.alert(
        "Error de Conexión",
        "Verifica tu internet o contacta al administrador."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Renderizado de iconos para el selector de turno
  const renderShiftIcon = (s: string) => {
    switch (s) {
      case "Dia":
        return <Sun size={16} color="#eab308" />;
      case "Tarde":
        return <Sunset size={16} color="#f97316" />;
      case "Noche":
        return <Moon size={16} color="#6366f1" />;
      default:
        return <Sun size={16} color="gray" />;
    }
  };

  if (!isLoaded) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={{ marginTop: 20, color: "#64748b" }}>
          Cargando reporte...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.titleContainer}>
              <View style={styles.iconBox}>
                <Truck size={20} color="#0f172a" strokeWidth={2.5} />
              </View>
              <View>
                <Text style={styles.headerTitle}>Scooptram ST-710</Text>
                <View style={styles.subtitleRow}>
                  <Text style={styles.headerSubtitle}>
                    Mantenimiento Diario
                  </Text>
                  <View style={styles.offlineTag}>
                    <CloudOff size={10} color="#4ade80" />
                    <Text style={styles.offlineText}>Local</Text>
                  </View>
                </View>
              </View>
            </View>
            <Text
              style={[
                styles.progressText,
                { color: isComplete ? "#4ade80" : "#facc15" },
              ]}
            >
              {progressPercent}%
            </Text>
          </View>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            style={styles.content}
            contentContainerStyle={{ paddingBottom: 140 }}
            ref={scrollViewRef}
          >
            {/* Tarjeta Datos Generales */}
            <View style={styles.card}>
              {(!operator || !hourMeterStart) && (
                <View style={styles.errorDot} />
              )}
              <View style={styles.cardHeader}>
                <User size={16} color="#64748b" />
                <Text style={styles.cardTitle}>DATOS DEL OPERADOR</Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  Nombre Operador <Text style={styles.asterisk}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej. Juan Pérez"
                  value={operator}
                  onChangeText={setOperator}
                />
              </View>

              <View style={styles.row}>
                {/* Selector de Turno (Mantenido) */}
                <View style={styles.col}>
                  <Text style={styles.label}>Turno</Text>
                  <TouchableOpacity
                    style={styles.pickerFake}
                    onPress={() => setShowShiftPicker(true)}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      {renderShiftIcon(shift)}
                      <Text style={{ fontSize: 16, color: "#1e293b" }}>
                        {shift}
                      </Text>
                    </View>
                    <ChevronDown size={16} color="gray" />
                  </TouchableOpacity>
                </View>

                <View style={styles.col}>
                  <Text style={styles.label}>
                    Horómetro Inicio <Text style={styles.asterisk}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="XXX.X"
                    keyboardType="numeric"
                    value={hourMeterStart}
                    onChangeText={(text) =>
                      handleNumericInput(text, setHourMeterStart)
                    }
                  />
                </View>
              </View>
            </View>

            {/* Categorías */}
            {CHECKLIST_DATA.map((category) => {
              const isActive = activeSection === category.id;
              const completedCount = category.items.filter(
                (i) => inspection[i.id]
              ).length;
              const totalCount = category.items.length;
              const isCatComplete = completedCount === totalCount;

              return (
                <View
                  key={category.id}
                  // Usamos onLayout para guardar la posición Y de manera compatible con web
                  onLayout={(event) => {
                    const layout = event.nativeEvent.layout;
                    categoryYPositions.current[category.id] = layout.y;
                  }}
                  style={[styles.card, isCatComplete && styles.cardComplete]}
                >
                  <TouchableOpacity
                    style={styles.accordionHeader}
                    onPress={() => toggleSection(category.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.accordionLeft}>
                      {category.icon}
                      <Text style={styles.accordionTitle}>
                        {category.title}
                      </Text>
                    </View>
                    <View style={styles.accordionRight}>
                      <View
                        style={[
                          styles.badge,
                          isCatComplete
                            ? styles.badgeSuccess
                            : styles.badgeNeutral,
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeText,
                            isCatComplete
                              ? styles.badgeTextSuccess
                              : styles.badgeTextNeutral,
                          ]}
                        >
                          {completedCount}/{totalCount}
                        </Text>
                      </View>
                      {isActive ? (
                        <ChevronUp size={20} color="#94a3b8" />
                      ) : (
                        <ChevronDown size={20} color="#94a3b8" />
                      )}
                    </View>
                  </TouchableOpacity>

                  {isActive && (
                    <View style={styles.accordionContent}>
                      {category.items.map((item) => {
                        const status = inspection[item.id];
                        return (
                          <View key={item.id} style={styles.itemRow}>
                            <View style={styles.itemTextContainer}>
                              <Text style={styles.itemLabel}>{item.label}</Text>
                              {item.subLabel && (
                                <Text style={styles.itemSubLabel}>
                                  {item.subLabel}
                                </Text>
                              )}
                            </View>
                            <View style={styles.buttonsContainer}>
                              <TouchableOpacity
                                onPress={() => toggleItem(item.id, "ok")}
                                style={[
                                  styles.checkButton,
                                  status === "ok"
                                    ? styles.btnOkActive
                                    : styles.btnInactive,
                                ]}
                              >
                                <CheckCircle2
                                  size={20}
                                  color={status === "ok" ? "white" : "#cbd5e1"}
                                />
                                <Text
                                  style={[
                                    styles.btnText,
                                    status === "ok"
                                      ? { color: "white" }
                                      : { color: "#cbd5e1" },
                                  ]}
                                >
                                  SI
                                </Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                onPress={() => toggleItem(item.id, "fail")}
                                style={[
                                  styles.checkButton,
                                  status === "fail"
                                    ? styles.btnFailActive
                                    : styles.btnInactive,
                                ]}
                              >
                                <XCircle
                                  size={20}
                                  color={
                                    status === "fail" ? "white" : "#cbd5e1"
                                  }
                                />
                                <Text
                                  style={[
                                    styles.btnText,
                                    status === "fail"
                                      ? { color: "white" }
                                      : { color: "#cbd5e1" },
                                  ]}
                                >
                                  NO
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}

                      <View style={styles.obsContainer}>
                        <View style={styles.obsHeader}>
                          <ClipboardCheck size={14} color="#64748b" />
                          <Text style={styles.obsLabel}>OBSERVACIONES</Text>
                        </View>
                        <TextInput
                          style={styles.textArea}
                          multiline
                          placeholder="Observaciones de la categoría..."
                          value={observations[category.id] || ""}
                          onChangeText={(t) =>
                            setObservations((prev) => ({
                              ...prev,
                              [category.id]: t,
                            }))
                          }
                        />
                      </View>
                    </View>
                  )}
                </View>
              );
            })}

            {/* Datos Finales */}
            <View style={[styles.card, styles.mt4]}>
              {!hourMeterEnd && <View style={styles.errorDot} />}
              <Text style={styles.label}>
                Horómetro Final <Text style={styles.asterisk}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="XXX.X"
                keyboardType="numeric"
                value={hourMeterEnd}
                onChangeText={(text) =>
                  handleNumericInput(text, setHourMeterEnd)
                }
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerContent}>
            <View style={styles.footerLeft}>
              <Text style={styles.footerLabel}>ESTADO DEL REPORTE</Text>
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusDot,
                    isComplete && styles.statusDotActive,
                  ]}
                />
                <Text
                  style={[
                    styles.statusText,
                    isComplete ? styles.textGreen : styles.textSlate,
                  ]}
                >
                  {isComplete ? "LISTO" : "Incompleto"}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.submitButton,
                (!isComplete || isSubmitting) && styles.submitButtonDisabled,
              ]}
              disabled={!isComplete || isSubmitting}
              onPress={handleSubmit}
            >
              {isSubmitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Send size={18} color={!isComplete ? "#94a3b8" : "white"} />
                  <Text
                    style={[
                      styles.submitText,
                      !isComplete && styles.submitTextDisabled,
                    ]}
                  >
                    {isSubmitting ? "..." : "Enviar"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Modal Picker para Turno */}
        <Modal
          visible={showShiftPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowShiftPicker(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowShiftPicker(false)}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Seleccionar Turno</Text>
              {SHIFTS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.modalOption,
                    shift === s && styles.modalOptionSelected,
                  ]}
                  onPress={() => {
                    setShift(s);
                    setShowShiftPicker(false);
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    {renderShiftIcon(s)}
                    <Text
                      style={[
                        styles.modalOptionText,
                        shift === s && styles.modalOptionTextSelected,
                      ]}
                    >
                      {s}
                    </Text>
                  </View>
                  {shift === s && <CheckCircle2 size={20} color="#2563EB" />}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

// --- Estilos ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3f4f6",
  },
  header: {
    backgroundColor: "#0f172a",
    padding: 16,
    paddingTop: 16,
    elevation: 4,
    zIndex: 10,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBox: {
    backgroundColor: "#eab308",
    padding: 8,
    borderRadius: 8,
  },
  headerTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  subtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerSubtitle: {
    color: "#94a3b8",
    fontSize: 12,
  },
  offlineTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#334155",
    gap: 4,
  },
  offlineText: {
    color: "#4ade80",
    fontSize: 10,
    fontWeight: "bold",
  },
  progressText: {
    fontSize: 24,
    fontWeight: "bold",
  },
  content: {
    padding: 16,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    position: "relative",
    overflow: "hidden",
  },
  cardComplete: {
    borderColor: "#bbf7d0",
  },
  errorDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    backgroundColor: "#ef4444",
    borderRadius: 4,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#64748b",
    letterSpacing: 0.5,
  },
  formGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
    marginBottom: 4,
  },
  asterisk: {
    color: "#ef4444",
  },
  input: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    color: "#1f2937",
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  col: {
    flex: 1,
  },
  pickerFake: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  accordionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  accordionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  accordionTitle: {
    fontWeight: "bold",
    color: "#1e293b",
    fontSize: 16,
  },
  accordionRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeNeutral: { backgroundColor: "#f3f4f6" },
  badgeSuccess: { backgroundColor: "#dcfce7" },
  badgeText: { fontSize: 12, fontWeight: "bold" },
  badgeTextNeutral: { color: "#64748b" },
  badgeTextSuccess: { color: "#15803d" },

  accordionContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f8fafc",
  },
  itemTextContainer: {
    flex: 1,
    paddingRight: 12,
  },
  itemLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#334155",
  },
  itemSubLabel: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 2,
  },
  buttonsContainer: {
    flexDirection: "row",
    gap: 8,
  },
  checkButton: {
    width: 44,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  btnInactive: {
    backgroundColor: "white",
    borderColor: "#e2e8f0",
  },
  btnOkActive: {
    backgroundColor: "#22c55e",
    borderColor: "#16a34a",
  },
  btnFailActive: {
    backgroundColor: "#ef4444",
    borderColor: "#dc2626",
  },
  btnText: {
    fontSize: 9,
    fontWeight: "bold",
    marginTop: -2,
  },
  obsContainer: {
    marginTop: 12,
    backgroundColor: "#fefce8",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fef08a",
    padding: 10,
  },
  obsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  obsLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#64748b",
    letterSpacing: 0.5,
  },
  textArea: {
    height: 60,
    textAlignVertical: "top",
    fontSize: 14,
    color: "#334155",
  },
  mt4: {
    marginTop: 16,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    paddingBottom: Platform.OS === "android" ? 24 : 0,
  },
  footerContent: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerLeft: {
    flex: 1,
  },
  footerLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#94a3b8",
    textTransform: "uppercase",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#facc15",
  },
  statusDotActive: {
    backgroundColor: "#22c55e",
  },
  statusText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  textGreen: { color: "#16a34a" },
  textSlate: { color: "#334155" },

  submitButton: {
    backgroundColor: "#2563EB",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  submitButtonDisabled: {
    backgroundColor: "#cbd5e1",
  },
  submitText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  submitTextDisabled: {
    color: "#94a3b8",
  },

  // --- Estilos del Modal ---
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 16,
    width: "100%",
    maxWidth: 320,
    padding: 20,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 16,
    textAlign: "center",
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  modalOptionSelected: {
    backgroundColor: "#eff6ff", // blue-50
    borderColor: "#2563EB",
  },
  modalOptionText: {
    fontSize: 16,
    color: "#334155",
    fontWeight: "500",
  },
  modalOptionTextSelected: {
    color: "#2563EB",
    fontWeight: "bold",
  },
});
