import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Activity {
    title: string;
    category: string;
    rating: string;
    date: string;
    duration?: number;
}

interface AreaStats {
    name: string;
    completed: number;
    total: number;
    percentage: number;
    color: string;
}

interface BabyData {
    name: string;
    age_range: string;
    birth_date: string;
}

export const generateMonthlyReportPDF = async (
    baby: BabyData,
    areas: AreaStats[],
    activities: Activity[],
    timeFrame: 'week' | 'month'
) => {
    const reportTitle = timeFrame === 'week' ? 'Reporte Semanal' : 'Reporte Mensual';
    const dateStr = format(new Date(), "d 'de' MMMM, yyyy", { locale: es });

    // Group activities by week or just list them if it's a week report
    // For now, let's just list them nicely organized by area
    const activitiesByArea = activities.reduce((acc, act) => {
        if (!acc[act.category]) acc[act.category] = [];
        acc[act.category].push(act);
        return acc;
    }, {} as Record<string, Activity[]>);

    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${reportTitle}</title>
    <style>
        body {
            font-family: 'Helvetica', 'Arial', sans-serif;
            color: #1e293b;
            margin: 0;
            padding: 40px;
            background-color: #ffffff;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #f1f5f9;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header-title h1 {
            margin: 0;
            font-size: 28px;
            color: #0f172a;
        }
        .header-title p {
            margin: 5px 0 0;
            color: #64748b;
            font-size: 14px;
        }
        .logo {
            font-weight: 900;
            font-size: 24px;
            color: #3b82f6;
        }
        .baby-info {
            background-color: #f8fafc;
            border-radius: 16px;
            padding: 20px;
            margin-bottom: 30px;
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
        }
        .info-item {
            flex: 1;
            min-width: 150px;
        }
        .info-label {
            font-size: 12px;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .info-value {
            font-size: 16px;
            font-weight: bold;
            color: #0f172a;
        }
        .section-title {
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 20px;
            color: #0f172a;
            border-left: 4px solid #3b82f6;
            padding-left: 10px;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            margin-bottom: 30px;
        }
        .stat-card {
            background-color: #ffffff;
            border: 1px solid #f1f5f9;
            border-radius: 12px;
            padding: 15px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .stat-info h3 {
            margin: 0;
            font-size: 14px;
            color: #64748b;
        }
        .stat-info p {
            margin: 5px 0 0;
            font-size: 18px;
            font-weight: 800;
        }
        .stat-progress {
            width: 50px;
            height: 50px;
            border-radius: 25px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 12px;
            border: 4px solid #f1f5f9;
        }
        .activities-container {
            margin-top: 30px;
        }
        .area-section {
            margin-bottom: 25px;
        }
        .area-header {
            font-size: 16px;
            font-weight: bold;
            padding: 8px 15px;
            border-radius: 8px;
            margin-bottom: 10px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th {
            text-align: left;
            font-size: 12px;
            color: #64748b;
            padding: 10px;
            border-bottom: 1px solid #f1f5f9;
        }
        td {
            padding: 12px 10px;
            border-bottom: 1px solid #f1f5f9;
            font-size: 14px;
        }
        .rating-badge {
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: bold;
        }
        .rating-solo { background-color: #eafaf1; color: #27ae60; }
        .rating-ayuda { background-color: #fdf7e3; color: #f39c12; }
        .rating-nada { background-color: #f2f4f6; color: #7f8c8d; }
        .rating-no-realizada { background-color: #fff1f2; color: #e11d48; }
        .footer {
            margin-top: 50px;
            text-align: center;
            font-size: 12px;
            color: #94a3b8;
            border-top: 1px solid #f1f5f9;
            padding-top: 20px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="header-title">
            <h1>${reportTitle}</h1>
            <p>Generado el ${dateStr}</p>
        </div>
        <div class="logo">NIDO</div>
    </div>

    <div class="baby-info">
        <div class="info-item">
            <div class="info-label">Bebé</div>
            <div class="info-value">${baby.name}</div>
        </div>
        <div class="info-item">
            <div class="info-label">Etapa</div>
            <div class="info-value">${baby.age_range}</div>
        </div>
        <div class="info-item">
            <div class="info-label">Fecha de Nacimiento</div>
            <div class="info-value">${format(new Date(baby.birth_date), 'd MMM, yyyy', { locale: es })}</div>
        </div>
    </div>

    <div class="section-title">Resumen de Progreso</div>
    <div class="stats-grid">
        ${areas.map(area => `
            <div class="stat-card">
                <div class="stat-info">
                    <h3>${area.name}</h3>
                    <p style="color: ${area.color}">${area.completed} / ${area.total} completadas</p>
                </div>
                <div class="stat-progress" style="border-top-color: ${area.color}; border-right-color: ${area.percentage > 25 ? area.color : '#f1f5f9'}; border-bottom-color: ${area.percentage > 50 ? area.color : '#f1f5f9'}; border-left-color: ${area.percentage > 75 ? area.color : '#f1f5f9'};">
                    ${area.percentage}%
                </div>
            </div>
        `).join('')}
    </div>

    <div class="section-title">Detalle de Actividades</div>
    <div class="activities-container">
        ${Object.keys(activitiesByArea).map(area => `
            <div class="area-section">
                <div class="area-header" style="background-color: ${areas.find(a => a.name === area)?.color + '15'}; color: ${areas.find(a => a.name === area)?.color}">
                    ${area}
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 50%;">Actividad</th>
                            <th style="width: 25%;">Fecha</th>
                            <th style="width: 25%;">Calificación</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${activitiesByArea[area].map(act => `
                            <tr>
                                <td><b>${act.title}</b></td>
                                <td>${act.date}</td>
                                <td>
                                    <span class="rating-badge ${
                                        act.rating === 'Lo hizo solo' ? 'rating-solo' : 
                                        act.rating === 'Con ayuda' ? 'rating-ayuda' : 
                                        act.rating === 'No lo intentó' ? 'rating-nada' : 
                                        act.rating === 'No realizada' ? 'rating-no-realizada' : 'rating-nada'
                                    }">
                                        ${act.rating}
                                    </span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `).join('')}
    </div>

    <div class="footer">
        <p>Reporte oficial generado por la aplicación NIDO.</p>
        <p>&copy; ${new Date().getFullYear()} Nido App</p>
    </div>
</body>
</html>
    `;

    try {
        const { uri } = await Print.printToFileAsync({ html, base64: false });
        console.log('PDF generated at:', uri);
        
        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri, {
                mimeType: 'application/pdf',
                dialogTitle: `Compartir ${reportTitle} de ${baby.name}`,
                UTI: 'com.adobe.pdf'
            });
        }
    } catch (error) {
        console.error('Error generating or sharing PDF:', error);
        throw error;
    }
};
