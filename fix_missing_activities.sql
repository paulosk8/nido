-- Script para insertar actividades en TODOS los rangos de edad
-- Esto evita que bebés mayores (ej. nacidos en 2025) se queden sin plan semanal.

DO $$
DECLARE
    v_area_motor uuid;
    v_area_language uuid;
    v_area_cognitive uuid;
    v_area_social uuid;
    r_record RECORD;
BEGIN
    -- Obtenemos los IDs de las áreas de estimulación
    SELECT area_id INTO v_area_motor FROM public.stimulation_area WHERE name ILIKE '%motor%' OR name ILIKE '%físic%' LIMIT 1;
    SELECT area_id INTO v_area_language FROM public.stimulation_area WHERE name ILIKE '%lenguaje%' OR name ILIKE '%comunica%' LIMIT 1;
    SELECT area_id INTO v_area_cognitive FROM public.stimulation_area WHERE name ILIKE '%cognitiv%' OR name ILIKE '%sensori%' LIMIT 1;
    SELECT area_id INTO v_area_social FROM public.stimulation_area WHERE name ILIKE '%social%' OR name ILIKE '%emocion%' LIMIT 1;

    -- Iterar sobre TODOS los rangos de edad para asegurar que ninguno quede vacío
    FOR r_record IN SELECT range_id FROM public.age_range
    LOOP
        -- Insertamos Actividades de Área MOTOR
        INSERT INTO activity (title, description, duration_est_minutes, range_id, is_for_premature, area_id) VALUES
        ('Rodar sobre la manta', 'Coloca al bebé sobre una manta suave y anímalo a rodar usando un juguete brillante.', 5, r_record.range_id, false, v_area_motor),
        ('Alcanzar y agarrar', 'Ofrécele juguetes a diferentes distancias para que intente alcanzarlos estirando sus brazos.', 8, r_record.range_id, false, v_area_motor),
        ('Tiempo boca abajo extendido', 'Coloca al bebé boca abajo con juguetes llamativos al frente para fortalecer cuello y espalda.', 10, r_record.range_id, false, v_area_motor),
        ('Bicicleta con las piernas', 'Acuéstalo boca arriba y mueve suavemente sus piernas simulando el pedaleo de una bicicleta.', 5, r_record.range_id, false, v_area_motor),
        ('Sentarse con apoyo', 'Siéntalo apoyado contra cojines y pon juguetes frente a él para que mantenga el equilibrio.', 8, r_record.range_id, false, v_area_motor),
        ('Gateo asistido', 'Coloca una toalla enrollada bajo su pecho y levántalo ligeramente para que sienta la postura de gateo.', 10, r_record.range_id, false, v_area_motor),
        ('Pataditas en el agua', 'Durante el baño, anímalo a chapotear moviendo sus piernas libremente.', 7, r_record.range_id, false, v_area_motor),
        ('Masaje activador', 'Realiza masajes suaves pero firmes en brazos y piernas para estimular la propiocepción.', 5, r_record.range_id, false, v_area_motor);

        -- Insertamos Actividades de Área LENGUAJE
        INSERT INTO activity (title, description, duration_est_minutes, range_id, is_for_premature, area_id) VALUES
        ('Imitación de sonidos', 'Repite los balbuceos y vocales que el bebé emita, esperando a que te "conteste".', 5, r_record.range_id, false, v_area_language),
        ('Lectura de cuentos ilustrados', 'Muestra un libro con imágenes grandes y nombra los objetos con voz clara y exagerada.', 10, r_record.range_id, false, v_area_language),
        ('Canciones de cuna y rimas', 'Cántale canciones sencillas acompañadas de gestos, sonriendo y manteniendo contacto visual.', 8, r_record.range_id, false, v_area_language),
        ('El juego de nombrar partes', 'Toca suavemente partes de su cuerpo (nariz, boca, manos) y nómbralas alegremente.', 5, r_record.range_id, false, v_area_language),
        ('Hacer sonidos de animales', 'Enséñale figuras de animales y haz los sonidos de cada uno repetidamente ("Muuu", "Guau").', 7, r_record.range_id, false, v_area_language),
        ('Narrar el día a día', 'Cuéntale al bebé todo lo que estás haciendo mientras lo bañas, vistes o alimentas.', 10, r_record.range_id, false, v_area_language),
        ('Juego de los opuestos con voz', 'Di palabras como "Arriba" con voz aguda y "Abajo" con voz grave mientras lo mueves.', 5, r_record.range_id, false, v_area_language),
        ('Diálogo frente al espejo', 'Mírense en un espejo y habla con él/ella, señalando a "bebé" y "mamá/papá".', 5, r_record.range_id, false, v_area_language);

        -- Insertamos Actividades de Área COGNITIVA
        INSERT INTO activity (title, description, duration_est_minutes, range_id, is_for_premature, area_id) VALUES
        ('Dónde está el juguete (Causa-efecto)', 'Esconde un juguete bajo una manta o caja frente a él y anímalo a destaparlo.', 5, r_record.range_id, false, v_area_cognitive),
        ('Exploración de texturas', 'Ofrécele objetos seguros de diferentes texturas (suave, rugoso, liso) para que los toque y explore.', 10, r_record.range_id, false, v_area_cognitive),
        ('Seguimiento visual complejo', 'Mueve un objeto llamativo lentamente en diferentes direcciones y asegúrate de que lo siga con los ojos.', 5, r_record.range_id, false, v_area_cognitive),
        ('Cajas musicales o sonajeros', 'Agita una caja de música o sonajero fuera de su vista para que gire la cabeza buscando la fuente del sonido.', 7, r_record.range_id, false, v_area_cognitive),
        ('Torre de bloques blandos', 'Apila dos o tres bloques grandes y blandos y deja que el bebé los derrumbe, observando el efecto.', 8, r_record.range_id, false, v_area_cognitive),
        ('Metidos y sacados', 'Coloca juguetes pequeños en un recipiente grande y muéstrale cómo sacarlos y volver a meterlos.', 10, r_record.range_id, false, v_area_cognitive),
        ('Juego de luces y sombras', 'Usa una linterna en una habitación oscura para proyectar sombras en la pared, estimulando su atención.', 5, r_record.range_id, false, v_area_cognitive),
        ('Texturas contrastantes en pies', 'Pasa suavemente por sus plantas de los pies algodón y luego una esponja, observando sus reacciones.', 5, r_record.range_id, false, v_area_cognitive);

        -- Insertamos Actividades de Área SOCIAL / EMOCIONAL
        INSERT INTO activity (title, description, duration_est_minutes, range_id, is_for_premature, area_id) VALUES
        ('Juego de "¿Dónde está el bebé?" (Peek-a-boo)', 'Cubre tu cara con tus manos y asómate sonriendo diciendo "¡Aquí estoy!". Fomenta la anticipación y la alegría.', 5, r_record.range_id, false, v_area_social),
        ('Masaje relajante con contacto visual', 'Realiza un masaje lento mirando directamente a sus ojos y sonriéndole para crear vínculo.', 10, r_record.range_id, false, v_area_social),
        ('Bailar pegaditos', 'Pon música suave, sostenlo cerca de tu pecho y bailen suavemente por la habitación.', 8, r_record.range_id, false, v_area_social),
        ('Reconocimiento facial en espejo', 'Mírense juntos en el espejo y haz diferentes expresiones faciales (alegría, sorpresa).', 5, r_record.range_id, false, v_area_social),
        ('El juego de las cosquillas suaves', 'Hazle cosquillas suaves en la barriguita o los pies, prestándole mucha atención a sus risas y parando si se sobreestimula.', 5, r_record.range_id, false, v_area_social),
        ('Interacción con otros miembros de familia', 'Fomenta que hermanos u otros familiares hablen suavemente con el bebé y le muestren cariño.', 10, r_record.range_id, false, v_area_social),
        ('Juego de "Dame y toma"', 'Ofrécele un objeto y luego pídeselo de vuelta amablemente extendiendo la mano ("¿Me lo das?").', 8, r_record.range_id, false, v_area_social),
        ('Consuelo y seguridad', 'Aprovecha momentos de llanto leve para cargarlo, mecerlo y hablarle suave, construyendo apego seguro.', 5, r_record.range_id, false, v_area_social);
    END LOOP;

END $$;
