/**
 * Traducción AZ-900 → Español (v3)
 * Enfoque híbrido:
 *   1. Pre-normalización de formatos alternativos (DRAG DROP\n- → DRAG DROP -)
 *   2. MAP exacto para textos narrativos únicos y completos
 *   3. Regex línea por línea para todos los elementos estructurales
 */
const fs = require('fs');
const src = JSON.parse(fs.readFileSync('./public/data/exam_63.json', 'utf-8'));

// ─── FASE 1: Pre-normalización ────────────────────────────────────────────────
// Algunos textos tienen "DRAG DROP\n-\n" en lugar de "DRAG DROP -\n"
function preNormalize(text) {
  if (!text) return text;
  return text
    .replace(/^DRAG DROP\s*\n-/m, 'DRAG DROP -')
    .replace(/^HOTSPOT\s*\n-/m, 'HOTSPOT -');
}

// ─── FASE 2: MAP exacto (textos narrativos únicos) ────────────────────────────
// Solo para textos muy específicos que no encajan en patrones genéricos.
// Cada entrada es [inglés_exacto, español]
const EXACT_MAP = [
  // Encabezados de pregunta
  ['Note: The question is included in a number of questions that depicts the identical set-up. However, every question has a distinctive result. Establish if the solution satisfies the requirements.',
   'Nota: Esta pregunta forma parte de un conjunto de preguntas con la misma configuración. Sin embargo, cada pregunta tiene un resultado diferente. Determine si la solución cumple los requisitos.'],

  ['Note: This question is part of a series of questions that present the same scenario. Each question in the series contains a unique solution that might meet the stated goals. Some question sets might have more than one correct solution, while others might not have a correct solution.\nAfter you answer a question in this section, you will NOT be able to return to it. As a result, these questions will not appear in the review screen.',
   'Nota: Esta pregunta forma parte de una serie con el mismo escenario. Cada pregunta contiene una solución única que podría cumplir los objetivos. Algunos conjuntos tienen más de una solución correcta; otros pueden no tenerla.\nDespués de responder, NO podrá volver a esta pregunta, por lo que no aparecerá en la pantalla de revisión.'],

  ['This question requires that you evaluate the underlined text to determine if it is correct.',
   'Esta pregunta requiere que evalúe el texto subrayado para determinar si es correcto.'],

  ['Instructions: Review the underlined text. If it makes the statement correct, select `No change is needed`. If the statement is incorrect, select the answer choice that makes the statement correct.',
   'Instrucciones: Revise el texto subrayado. Si hace correcto el enunciado, seleccione "No se necesita ningún cambio". Si es incorrecto, seleccione la opción que lo corrija.'],

  // Textos completos de preguntas narrativas específicas
  ['Your company plans to migrate to Azure.\nThe company has several departments. All the Azure resources used by each department will be managed by a department administrator.\nWhat are two possible techniques to segment Azure for the departments? Each correct answer presents a complete solution.\nNOTE: Each correct selection is worth one point.',
   'Su empresa planea migrar a Azure.\nLa empresa tiene varios departamentos. Todos los recursos de Azure de cada departamento serán administrados por un administrador de departamento.\n¿Cuáles son dos técnicas posibles para segmentar Azure por departamento? Cada respuesta correcta presenta una solución completa.\nNOTA: Cada selección correcta vale un punto.'],

  ['Your company plans to move several servers to Azure.\nThe company\'s compliance policy states that a server named FinServer must be on a separate network segment.\nYou are evaluating which Azure services can be used to meet the compliance policy requirements.\nWhich Azure solution should you recommend?',
   'Su empresa planea mover varios servidores a Azure.\nLa política de cumplimiento establece que un servidor llamado FinServer debe estar en un segmento de red separado.\nEstá evaluando qué servicios de Azure pueden usarse para cumplir los requisitos.\n¿Qué solución de Azure debe recomendar?'],

  ['Your company plans to start using Azure and will migrate all its network resources to Azure.\nYou need to start the planning process by exploring Azure.\nWhat should you create first?',
   'Su empresa planea comenzar a usar Azure y migrará todos sus recursos de red a Azure.\nNecesita iniciar el proceso de planificación explorando Azure.\n¿Qué debe crear primero?'],

  ['You have an Azure environment that contains multiple Azure virtual machines.\nYou plan to implement a solution that enables the client computers on your on-premises network to communicate to the Azure virtual machines.\nYou need to recommend which Azure resources must be created for the planned solution.\nWhich two Azure resources should you include in the recommendation? Each correct answer presents part of the solution.\nNOTE: Each correct selection is worth one point.',
   'Tiene un entorno de Azure con múltiples máquinas virtuales.\nPlanea implementar una solución que permita a los equipos de su red local comunicarse con las máquinas virtuales de Azure.\nNecesita recomendar qué recursos de Azure deben crearse.\n¿Qué dos recursos de Azure debe incluir? Cada respuesta correcta presenta parte de la solución.\nNOTA: Cada selección correcta vale un punto.'],

  ['You attempt to create several managed Microsoft SQL Server instances in an Azure environment and receive a message that you must increase your Azure subscription limits.\nWhat should you do to increase the limits?',
   'Intenta crear varias instancias administradas de Microsoft SQL Server en Azure y recibe un mensaje indicando que debe aumentar los límites de su suscripción de Azure.\n¿Qué debe hacer para aumentar los límites?'],

  ['You plan to map a network drive from several computers that run Windows 10 to Azure Storage.\nYou need to create a storage solution in Azure for the planned mapped drive.\nWhat should you create?',
   'Planea asignar una unidad de red desde varios equipos con Windows 10 a Azure Storage.\nNecesita crear una solución de almacenamiento en Azure para la unidad de red asignada.\n¿Qué debe crear?'],

  ['You need to be notified when Microsoft plans to perform maintenance that can affect the resources deployed to an Azure subscription.\nWhat should you use?',
   'Necesita recibir una notificación cuando Microsoft planee realizar mantenimiento que pueda afectar los recursos implementados en una suscripción de Azure.\n¿Qué debe usar?'],

  ['Which Azure service should you use to collect events from multiple resources into a centralized repository?',
   '¿Qué servicio de Azure debe usar para recopilar eventos de múltiples recursos en un repositorio centralizado?'],

  ['Your company has an Azure subscription that contains resources in several regions.\nYou need to ensure that administrators can only create resources in those regions.\nWhat should you use?',
   'Su empresa tiene una suscripción de Azure con recursos en varias regiones.\nNecesita asegurarse de que los administradores solo puedan crear recursos en esas regiones.\n¿Qué debe usar?'],

  ['What is the function of a Site-to-Site VPN?',
   '¿Cuál es la función de una VPN Site-to-Site?'],

  ['What is the most severe failure from which an Azure Availability Zone can be used to protect access to Azure service?',
   '¿Cuál es el fallo más grave del que puede proteger una Availability Zone de Azure en cuanto al acceso a los servicios de Azure?'],

  ['At which OSI layer does ExpressRoute operate?',
   '¿En qué capa del modelo OSI opera ExpressRoute?'],

  ['You plan to store 20 TB of data in Azure. The data will be accessed infrequently and visualized by using Microsoft Power BI.\nYou need to recommend a storage solution for the data.\nWhich two solutions should you recommend? Each correct answer presents a complete solution.\nNOTE: Each correct selection is worth one point.',
   'Planea almacenar 20 TB de datos en Azure. Los datos serán accedidos con poca frecuencia y visualizados con Microsoft Power BI.\nNecesita recomendar una solución de almacenamiento.\n¿Qué dos soluciones debe recomendar? Cada respuesta correcta presenta una solución completa.\nNOTA: Cada selección correcta vale un punto.'],

  ['Your company\'s Active Directory forest includes thousands of user accounts.\nYou have been informed that all network resources will be migrated to Azure. Thereafter, the on-premises data center will be retired.\nYou are required to employ a strategy that reduces the effect on users, once the planned migration has been completed.',
   'El bosque de Active Directory de su empresa incluye miles de cuentas de usuario.\nSe le ha informado que todos los recursos de red se migrarán a Azure. Posteriormente, el centro de datos local se retirará.\nDebe implementar una estrategia que reduzca el impacto en los usuarios una vez completada la migración.'],

  ['Your company\'s infrastructure includes a number of business units that each need a large number of various Azure resources for everyday operation.\nThe resources required by each business unit are identical.\nYou are required to sanction a strategy to create Azure resources automatically.',
   'La infraestructura de su empresa incluye varias unidades de negocio que necesitan muchos recursos de Azure para sus operaciones diarias.\nLos recursos requeridos por cada unidad de negocio son idénticos.\nDebe aprobar una estrategia para crear recursos de Azure automáticamente.'],

  ['You are required to deploy an Artificial Intelligence (AI) solution in Azure.\nYou want to make sure that you are able to build, test, and deploy predictive analytics for the solution.',
   'Debe implementar una solución de Inteligencia Artificial (IA) en Azure.\nQuiere asegurarse de poder crear, probar e implementar análisis predictivos para la solución.'],

  ['Your company is planning to migrate all their virtual machines to an Azure pay-as-you-go subscription. The virtual machines are currently hosted on the Hyper-V hosts in a data center.\nYou are required make sure that the intended Azure solution uses the correct expenditure model.',
   'Su empresa planea migrar todas sus máquinas virtuales a una suscripción de Azure de pago por uso. Las máquinas virtuales están alojadas en hosts Hyper-V en un centro de datos.\nDebe asegurarse de que la solución de Azure utilice el modelo de gasto correcto.'],

  ['An Azure administrator plans to run a PowerShell script that creates Azure resources.\nYou need to recommend which computer configuration to use to run the script.',
   'Un administrador de Azure planea ejecutar un script de PowerShell que crea recursos de Azure.\nNecesita recomendar qué configuración de equipo usar para ejecutar el script.'],

  ['You have an Azure environment. You need to create a new Azure virtual machine from a tablet that runs the Android operating system.',
   'Tiene un entorno de Azure. Necesita crear una nueva máquina virtual de Azure desde una tableta con sistema operativo Android.'],

  // Opciones de respuesta comunes
  ['A. Yes', 'A. Sí'],
  ['B. No', 'B. No'],
  ['No change is needed', 'No se necesita ningún cambio'],
  ['Create a service health alert', 'Crear una alerta de Service Health'],
  ['Upgrade your support plan', 'Actualizar su plan de soporte'],
  ['Modify an Azure policy', 'Modificar una Azure Policy'],
  ['Create a new support request', 'Crear una nueva solicitud de soporte'],
  ['a virtual network gateway', 'un Virtual Network Gateway'],
  ['a load balancer', 'un Load Balancer'],
  ['an application gateway', 'un Application Gateway'],
  ['a virtual network', 'una Virtual Network'],
  ['a gateway subnet', 'una Gateway Subnet'],
  ['an Azure SQL database', 'una base de datos Azure SQL'],
  ['a virtual machine data disk', 'un disco de datos de máquina virtual'],
  ['a File service in a storage account', 'un servicio File en una Storage Account'],
  ['a Blob service in a storage account', 'un servicio Blob en una Storage Account'],
  ['a subscription', 'una suscripción'],
  ['a resource group', 'un Resource Group'],
  ['a management group', 'un Management Group'],
  ['a reservation', 'una reserva'],
  ['Deploy the virtual machines to two or more availability zones.', 'Implementar las máquinas virtuales en dos o más Availability Zones.'],
  ['Deploy the virtual machines to two or more resource groups.', 'Implementar las máquinas virtuales en dos o más Resource Groups.'],
  ['Deploy the virtual machines to a scale set.', 'Implementar las máquinas virtuales en un Scale Set.'],
  ['Deploy the virtual machines to two or more regions.', 'Implementar las máquinas virtuales en dos o más regiones.'],
  ['You deploy the virtual machines to two or more availability zones.', 'Implementa las máquinas virtuales en dos o más Availability Zones.'],
  ['You deploy the virtual machines to two or more scale sets.', 'Implementa las máquinas virtuales en dos o más Scale Sets.'],
  ['You deploy the virtual machines to two or more regions.', 'Implementa las máquinas virtuales en dos o más regiones.'],
  ['provides a secure connection between a computer on a public network and the corporate network', 'proporciona una conexión segura entre un equipo en una red pública y la red corporativa'],
  ['provides a dedicated private connection to Azure that does NOT travel over the internet', 'proporciona una conexión privada dedicada a Azure que NO viaja por internet'],
  ['provides a connection from an on-premises VPN device to an Azure VPN gateway', 'proporciona una conexión desde un dispositivo VPN local a un Azure VPN Gateway'],
  ['Run the script from a computer that runs Linux and has the Azure CLI tools installed.', 'Ejecutar el script desde un equipo con Linux que tenga las herramientas de Azure CLI instaladas.'],
  ['Run the script from a computer that runs Chrome OS and uses Azure Cloud Shell.', 'Ejecutar el script desde un equipo con Chrome OS usando Azure Cloud Shell.'],
  ['Run the script from a computer that runs macOS and has PowerShell Core 6.0 installed.', 'Ejecutar el script desde un equipo con macOS que tenga PowerShell Core 6.0 instalado.'],
  ['You use Bash in Azure Cloud Shell.', 'Usa Bash en Azure Cloud Shell.'],
  ['You use PowerShell in Azure Cloud Shell.', 'Usa PowerShell en Azure Cloud Shell.'],
  ['a physical server failure', 'un fallo en un servidor físico'],
  ['an Azure region failure', 'un fallo en una región de Azure'],
  ['a storage failure', 'un fallo de almacenamiento'],
  ['an Azure data center failure', 'un fallo en un centro de datos de Azure'],
  ['Solution: You should recommend the use of the elastic expenditure model.', 'Solución: Debe recomendar el modelo de gasto elástico.'],
  ['Solution: You should recommend the use of the scalable expenditure model.', 'Solución: Debe recomendar el modelo de gasto escalable.'],
  ['Solution: You should recommend the use of the operational expenditure model.', 'Solución: Debe recomendar el modelo de gasto operativo.'],
  ['Solution: You should make use of Azure Machine Learning Studio.', 'Solución: Debe usar Azure Machine Learning Studio.'],
  ['Solution: You should make use of Azure Cosmos DB.', 'Solución: Debe usar Azure Cosmos DB.'],
  ['Solution: You plan to sync all the Active Directory user accounts to Azure Active Directory (Azure AD).', 'Solución: Planea sincronizar todas las cuentas de Active Directory con Azure Active Directory (Azure AD).'],
  ['Solution: You recommend that the Azure API Management service be included in the strategy.', 'Solución: Recomienda incluir el servicio Azure API Management en la estrategia.'],
  ['Solution: You recommend that management groups be included in the strategy.', 'Solución: Recomienda incluir Management Groups en la estrategia.'],

  // ── Cuerpo de preguntas DRAG DROP específicas (Q1, etc.) ──
  ['Your company intends to subscribe to an Azure support plan.',
   'Su empresa tiene la intención de suscribirse a un plan de soporte de Azure.'],
  ['The support plan must allow for new support requests to be opened.',
   'El plan de soporte debe permitir abrir nuevas solicitudes de soporte.'],
  ['Which of the following are support plans that will allow this? Answer by dragging the correct option from the list to the answer area.',
   '¿Cuáles de los siguientes son planes de soporte que lo permitirán? Responda arrastrando la opción correcta de la lista al área de respuesta.'],
];

// ─── FASE 3: Regex línea por línea ────────────────────────────────────────────
// Traduce cada línea individualmente si coincide con un patrón estructural.
// Esto maneja DRAG DROP, HOTSPOT y cualquier variante de instrucción.
const LINE_REGEX = [
  // ── Encabezados principales ──
  [/^DRAG DROP -$/, () => 'ARRASTRE Y SUELTE -'],
  [/^HOTSPOT -$/, () => 'PUNTO ACTIVO -'],

  // ── Instrucciones DRAG DROP: "Match X to Y" ──
  // "Match the [X] to the correct/appropriate [Y]."
  [/^Match the (.+?) to the correct (.+?)\.?$/, (_, x, y) =>
    `Relacione ${x} con la ${y} correcta.`],
  [/^Match the (.+?) to the appropriate (.+?)\.?$/, (_, x, y) =>
    `Relacione ${x} con la ${y} apropiada.`],
  // "Match [X] to the correct [Y]." (sin "the" al inicio)
  [/^Match (.+?) to the correct (.+?)\.?$/, (_, x, y) =>
    `Relacione ${x} con la ${y} correcta.`],
  [/^Match (.+?) to the appropriate (.+?)\.?$/, (_, x, y) =>
    `Relacione ${x} con la ${y} apropiada.`],

  // ── Instrucciones DRAG DROP: "To answer, drag..." ──
  // Con "Instructions:" al inicio
  [/^Instructions: To answer, drag the appropriate (.+?) from the column on the left to its (.+?) on the right[. ]+Each .+? may be used once, more than once, or not at all\.?$/,
    (_, what, dest) => `Instrucciones: Para responder, arrastre el ${what} apropiado de la columna izquierda a su ${dest} en la derecha. Cada uno puede usarse una vez, más de una vez o ninguna.`],
  // Sin "Instructions:"
  [/^To answer, drag the appropriate (.+?) from the column on the left to its (.+?) on the right[. ]+Each .+? may be used once, more than once, or not at all\.?$/,
    (_, what, dest) => `Para responder, arrastre el ${what} apropiado de la columna izquierda a su ${dest} en la derecha. Cada uno puede usarse una vez, más de una vez o ninguna.`],
  // Variante sin "Each ... may be used"
  [/^To answer, drag the appropriate (.+?) from the column on the left to its (.+?) on the right\.?$/,
    (_, what, dest) => `Para responder, arrastre el ${what} apropiado de la columna izquierda a su ${dest} en la derecha.`],

  // ── Instrucciones DRAG DROP: "move/arrange" ──
  [/^To answer, move all (.+?) from the list of .+? to the answer area and arrange them in the correct order\.?$/,
    (_, what) => `Para responder, mueva todos los ${what} de la lista al área de respuesta y ordénelos correctamente.`],
  [/^In which order should you (list|arrange) (.+?) from (.+?) to (.+?)\?/,
    (_, verb, what, from, to) => `¿En qué orden debe ${verb === 'list' ? 'listar' : 'ordenar'} ${what} de ${from} a ${to}?`],

  // ── Instrucciones HOTSPOT ──
  [/^For each of the following statements, select Yes if the statement is true\. Otherwise, select No\.?$/,
    () => 'Para cada afirmación, seleccione Sí si es verdadera; de lo contrario, seleccione No.'],
  [/^To complete the sentence, select the appropriate option in the answer area\.?$/,
    () => 'Para completar la oración, seleccione la opción apropiada en el área de respuesta.'],
  [/^Select the answer that correctly completes the sentence\.?$/,
    () => 'Seleccione la respuesta que completa correctamente la oración.'],
  [/^To answer, select the appropriate (option|service|blade|resource|icon|setting|node) in the answer area\.?$/,
    () => 'Para responder, seleccione la opción apropiada en el área de respuesta.'],
  [/^To answer, select the appropriate options? in the answer area\.?$/,
    () => 'Para responder, seleccione la opción apropiada en el área de respuesta.'],

  // ── Marcadores comunes ──
  [/^Hot Area:$/, () => 'Área de respuesta:'],
  [/^Select and Place:$/, () => 'Seleccionar y colocar:'],
  [/^NOTE: Each correct selection is worth one point\.?$/, () => 'NOTA: Cada selección correcta vale un punto.'],
  [/^NOTE: Each correct match is worth one point\.?$/, () => 'NOTA: Cada coincidencia correcta vale un punto.'],
  [/^Each correct answer presents a complete solution\.?$/, () => 'Cada respuesta correcta presenta una solución completa.'],
  [/^Each correct answer presents part of the solution\.?$/, () => 'Cada respuesta correcta presenta parte de la solución.'],
  [/^Does the solution meet the goal\?$/, () => '¿La solución cumple el objetivo?'],
  [/^Does this meet the goal\?$/, () => '¿Esto cumple el objetivo?'],
  [/^You may need to drag the split bar between panes or scroll to view content\.?$/, () => 'Es posible que deba arrastrar la barra divisoria o desplazarse para ver el contenido.'],
  [/^Answer by dragging the correct option from the list to the answer area\.?$/, () => 'Responda arrastrando la opción correcta de la lista al área de respuesta.'],

  // ── Número de pregunta ──
  [/^Question (\d+)$/, (_, n) => `Pregunta ${n}`],
];

function translateLine(line) {
  for (const [regex, fn] of LINE_REGEX) {
    if (regex.test(line)) {
      return line.replace(regex, fn);
    }
  }
  return line;
}

// ─── Pipeline de traducción ────────────────────────────────────────────────────
function translate(text) {
  if (!text) return text;

  // Fase 1: pre-normalizar formatos alternativos
  let t = preNormalize(text);

  // Fase 2: MAP exacto (textos completos o frases largas)
  for (const [en, es] of EXACT_MAP) {
    if (t.includes(en)) {
      t = t.split(en).join(es);
    }
  }

  // Fase 3: línea por línea con regex
  t = t
    .split('\n')
    .map(translateLine)
    .join('\n');

  return t;
}

function translateQ(q) {
  return {
    number:        translate(q.number),
    questionText:  translate(q.questionText),
    ...(q.options      ? { options: q.options.map(translate) } : {}),
    ...(q.correctAnswer ? { correctAnswer: translate(q.correctAnswer) } : {}),
    ...(q.images       ? { images: q.images } : {}),
  };
}

// ─── Generar JSON ─────────────────────────────────────────────────────────────
const questions = src.questions.map(translateQ);

fs.writeFileSync('./public/data/exam_63_es.json', JSON.stringify({
  examId:         src.examId,
  examTitle:      src.examTitle,
  totalQuestions: src.totalQuestions,
  scrapedAt:      src.scrapedAt,
  language:       'es',
  questions,
}, null, 2), 'utf-8');

// ─── Verificación de calidad ──────────────────────────────────────────────────
const enQ = src.questions;

// Contar cuántos siguen con DRAG DROP / HOTSPOT sin traducir
const stillEnDD = questions.filter(q => q.questionText?.includes('DRAG DROP')).length;
const stillEnHS = questions.filter(q => q.questionText?.includes('HOTSPOT')).length;
console.log(`\n📊 Verificación post-traducción:`);
console.log(`   DRAG DROP sin traducir: ${stillEnDD} / ${enQ.filter(q=>q.questionText?.includes('DRAG DROP')).length}`);
console.log(`   HOTSPOT sin traducir:   ${stillEnHS} / ${enQ.filter(q=>q.questionText?.includes('HOTSPOT')).length}`);

// Muestras de DRAG DROP
console.log('\n─── DRAG DROP ejemplo ───');
const dd = questions.find(q => q.questionText?.includes('ARRASTRE'));
if (dd) console.log(dd.questionText?.substring(0, 400));

// Muestras de HOTSPOT
console.log('\n─── PUNTO ACTIVO ejemplo ───');
const hs = questions.find(q => q.questionText?.includes('PUNTO ACTIVO'));
if (hs) console.log(hs.questionText?.substring(0, 400));

// Muestra general
const samples = [0, 2, 7, 35, 48, 58, 100, 200];
samples.forEach(i => {
  const q = questions[i];
  if (!q) return;
  console.log(`\n── ${q.number} ──`);
  console.log(q.questionText?.substring(0, 200));
  if (q.options) console.log('Opc:', q.options.slice(0,2).join(' | '));
});

console.log(`\n✓ ${questions.length} preguntas traducidas → public/data/exam_63_es.json`);
