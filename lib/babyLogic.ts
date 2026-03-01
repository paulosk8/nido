import { differenceInMonths, parseISO } from 'date-fns';

export const calculateBabyAges = (birthDateStr: string, gestationalWeeks: number) => {
    const birthDate = parseISO(birthDateStr);
    const today = new Date();

    // Edad Cronológica (Meses totales desde nacimiento)
    const cronologicalMonths = differenceInMonths(today, birthDate);

    // Si fue prematuro (menos de 37 semanas)
    let correctedMonths = cronologicalMonths;
    let isPremature = gestationalWeeks < 37;

    if (isPremature) {
        // Calculamos cuántas semanas le faltaron (40 es el término)
        const weeksMissing = 40 - gestationalWeeks;
        const prematurityMonths = (weeksMissing * 7) / 30.44; // Conversión a meses aprox.

        // La edad corregida es la cronológica menos el tiempo de prematuridad
        correctedMonths = Math.max(0, cronologicalMonths - prematurityMonths);
    }

    return {
        cronological: Math.floor(cronologicalMonths),
        corrected: Math.floor(correctedMonths),
        isPremature
    };
};