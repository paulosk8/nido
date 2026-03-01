import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, RadioButton, Text } from 'react-native-paper';
import { supabase } from '../lib/supabase';

export default function EvaluationScreen() {
    const { log_id, activity_id } = useLocalSearchParams<{ log_id: string; activity_id: string }>();
    const router = useRouter();

    const [questions, setQuestions] = useState<any[]>([]);
    const [responses, setResponses] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchQuestions = async () => {
            const { data } = await supabase
                .from('evaluation_question')
                .select('*')
                .eq('activity_id', activity_id)
                .order('order_index', { ascending: true });
            if (data) setQuestions(data);
        };
        fetchQuestions();
    }, [activity_id]);

    const handleSave = async () => {
        setLoading(true);

        const evaluationsToInsert = questions.map(q => ({
            log_id,
            question_id: q.question_id,
            score: responses[q.question_id] || 0,
            achieved: (responses[q.question_id] || 0) >= 5, // example condition
        }));

        if (evaluationsToInsert.length > 0) {
            await supabase.from('evaluation_response').insert(evaluationsToInsert);
        }

        router.replace('/(tabs)');
        setLoading(false);
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text variant="headlineSmall" style={styles.title}>Evaluación de Actividad</Text>

            {questions.length === 0 ? (
                <Text style={styles.emptyText}>No hay preguntas para esta actividad. Presiona guardar para terminar.</Text>
            ) : (
                questions.map((q) => (
                    <Card key={q.question_id} style={styles.card}>
                        <Card.Content>
                            <Text variant="bodyLarge" style={styles.questionText}>{q.question_text}</Text>
                            <RadioButton.Group
                                onValueChange={val => setResponses({ ...responses, [q.question_id]: parseInt(val) })}
                                value={responses[q.question_id]?.toString() || '0'}
                            >
                                <View style={styles.radioRow}><RadioButton value="10" /><Text>Logrado</Text></View>
                                <View style={styles.radioRow}><RadioButton value="5" /><Text>En proceso</Text></View>
                                <View style={styles.radioRow}><RadioButton value="0" /><Text>No intentado/Aún no lo logra</Text></View>
                            </RadioButton.Group>
                        </Card.Content>
                    </Card>
                ))
            )}

            <Button mode="contained" onPress={handleSave} loading={loading} style={styles.btn}>
                Guardar Evaluación
            </Button>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flexGrow: 1, padding: 20 },
    title: { fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    card: { marginBottom: 15 },
    questionText: { marginBottom: 10, fontWeight: 'bold' },
    radioRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
    emptyText: { textAlign: 'center', marginBottom: 20 },
    btn: { marginTop: 20 }
});
