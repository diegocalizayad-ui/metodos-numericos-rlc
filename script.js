// Variable global para guardar la data del osciloscopio
let dataOsciloscopio = null;

// =========================================================
// 1. NAVEGACIÓN ENTRE BOTONES / VISTAS
// =========================================================
function cambiarVista(idSeccion, botonPresionado) {
  const modulos = document.querySelectorAll('.modulo-vista');
  modulos.forEach(mod => mod.classList.add('oculto'));

  document.getElementById(idSeccion).classList.remove('oculto');

  const botones = document.querySelectorAll('.btn-nav');
  botones.forEach(btn => btn.classList.remove('activo'));
  botonPresionado.classList.add('activo');

  if (idSeccion === 'vista-rk4') {
    Plotly.Plots.resize('grafico-rk4');
  }
}

// =========================================================
// 2. ALGORITMOS: POTENCIA Y POTENCIA INVERTIDA
// =========================================================
function calcularMetodoPotencia(A, esInvertida = false) {
  let x = [1.0, 1.0]; 
  let tol = 1e-4;     
  let maxIter = 10;
  let historial = [];
  let lambdaAnt = 0;

  let M = A;
  if (esInvertida) {
    let det = A[0][0] * A[1][1] - A[0][1] * A[1][0];
    M = [
      [ A[1][1] / det, -A[0][1] / det],
      [-A[1][0] / det,  A[0][0] / det]
    ];
  }

  for (let k = 1; k <= maxIter; k++) {
    let y = [
      M[0][0] * x[0] + M[0][1] * x[1],
      M[1][0] * x[0] + M[1][1] * x[1]
    ];

    let c1 = Math.abs(y[0]);
    let c2 = Math.abs(y[1]);
    let factorEscalar = (c1 >= c2) ? y[0] : y[1];

    let x_nuevo = [y[0] / factorEscalar, y[1] / factorEscalar];
    let lambdaEst = esInvertida ? (1.0 / factorEscalar) : factorEscalar;
    let errorRel = (k === 1) ? 1.0 : Math.abs((lambdaEst - lambdaAnt) / lambdaEst);

    historial.push({
      iter: k,
      lambda: lambdaEst,
      x1: x_nuevo[0],
      x2: x_nuevo[1],
      error: errorRel
    });

    x = x_nuevo;
    lambdaAnt = lambdaEst;

    if (errorRel < tol && k > 1) break;
  }

  return historial;
}

function renderizarPotenciaMatematica(idTabla, idResultado, historial, esInvertida) {
  const tbody = document.querySelector(`#${idTabla} tbody`);
  tbody.innerHTML = '';

  historial.forEach(h => {
    tbody.innerHTML += `
      <tr>
        <td>${h.iter}</td>
        <td><b>${h.lambda.toFixed(4)}</b></td>
        <td>[${h.x1.toFixed(4)}, ${h.x2.toFixed(4)}]</td>
        <td>${h.error.toExponential(3)}</td>
      </tr>`;
  });

  const ultimo = historial[historial.length - 1];
  const tipoAutovalor = esInvertida ? "menor magnitud (λ_mín)" : "dominante (λ_máx)";

  document.getElementById(idResultado).innerHTML = `
    <p><b>Resultado final en iteración ${ultimo.iter}:</b> Autovalor λ = <b>${ultimo.lambda.toFixed(4)}</b> | Autovector v = <b>[${ultimo.x1.toFixed(4)}, ${ultimo.x2.toFixed(4)}]ᵀ</b></p>
    <p><b>¿Qué hallamos y qué significa?:</b> Este método calcula el autovalor de <b>${tipoAutovalor}</b> de la matriz de estados A. Matemáticamente, λ representa la tasa de cambio del sistema, mientras que el autovector v indica la relación de proporción entre el voltaje Vc y su derivada dVc/dt.</p>
  `;
}

// =========================================================
// 3. FUNCIÓN PRINCIPAL DE CÁLCULO
// =========================================================
function calcularTodo() {
  const R = parseFloat(document.getElementById('paramR').value);
  const L = parseFloat(document.getElementById('paramL').value) / 1000.0; 
  const C = parseFloat(document.getElementById('paramC').value) / 1e6;    
  const Vin = parseFloat(document.getElementById('paramVin').value);
  const Vobj = parseFloat(document.getElementById('paramVobj').value);

  // --- A. MÉTODO ANALÍTICO DIRECTO ---
const alpha = R / (2 * L);
const omega0_sq = 1 / (L * C);
const detA = omega0_sq;
const trA = -R / L;
const disc = alpha * alpha - omega0_sq;

let txtRegimen = "";
let txtAutovalores = "";

if (disc < 0) {
  // Autovalores complejos conjugados
  const omega_d = Math.sqrt(-disc);
  txtRegimen = '<b style="color: #0284c7;">Subamortiguado (Oscilatorio)</b>';
  txtAutovalores = `-${alpha.toFixed(2)} ± j${omega_d.toFixed(2)} rad/s`;
} else if (disc > 0) {
  // Autovalores reales distintos
  const val = Math.sqrt(disc);
  const l1 = -alpha + val;
  const l2 = -alpha - val;
  txtRegimen = '<b style="color: #16a34a;">Sobreamortiguado (Sin oscilación)</b>';
  txtAutovalores = `${l1.toFixed(2)} y ${l2.toFixed(2)} rad/s (Reales)`;
} else {
  // Autovalores reales iguales
  txtRegimen = '<b style="color: #eab308;">Críticamente Amortiguado</b>';
  txtAutovalores = `-${alpha.toFixed(2)} rad/s (Real doble)`;
}

document.getElementById('info-analitico').innerHTML = `
  <p><b>Traza tr(A):</b> ${trA.toFixed(2)}</p>
  <p><b>Determinante det(A):</b> ${detA.toExponential(4)}</p>
  <p><b>Polinomio Característico:</b> λ² + ${(R/L).toFixed(2)}λ + ${detA.toExponential(3)} = 0</p>
  <p><b>Autovalores Exactos (λ₁,₂):</b> ${txtAutovalores}</p>
  <p><b>Régimen del Circuito:</b> ${txtRegimen}</p>
`;

  // --- B. EJECUCIÓN DE POTENCIA Y POTENCIA INVERTIDA ---
  const A = [
    [0, 1.0],
    [-1.0 / (L * C), -R / L]
  ];

  const histPot = calcularMetodoPotencia(A, false);
  renderizarPotenciaMatematica('tabla-potencia', 'resultado-potencia', histPot, false);

  const histPotInv = calcularMetodoPotencia(A, true);
  renderizarPotenciaMatematica('tabla-potencia-inv', 'resultado-potencia-inv', histPotInv, true);

  // --- C. RUNGE-KUTTA 4TO ORDEN (RK4) ---
  const dt = 1e-6;          
  const t_final = 0.0003;   
  const pasos = Math.floor(t_final / dt);

  let vec_t = [];
  let vec_Vc = [];
  let y1 = 0, y2 = 0; 

  for (let i = 0; i < pasos; i++) {
    let t = i * dt;
    vec_t.push(t * 1000); 
    vec_Vc.push(y1);

    let f1 = (y_1, y_2) => y_2;
    let f2 = (y_1, y_2) => (Vin / (L * C)) - (R / L) * y_2 - (1 / (L * C)) * y_1;

    let k1_1 = f1(y1, y2), k1_2 = f2(y1, y2);
    let k2_1 = f1(y1 + 0.5 * dt * k1_1, y2 + 0.5 * dt * k1_2);
    let k2_2 = f2(y1 + 0.5 * dt * k1_1, y2 + 0.5 * dt * k1_2);
    let k3_1 = f1(y1 + 0.5 * dt * k2_1, y2 + 0.5 * dt * k2_2);
    let k3_2 = f2(y1 + 0.5 * dt * k2_1, y2 + 0.5 * dt * k2_2);
    let k4_1 = f1(y1 + dt * k3_1, y2 + dt * k3_2);
    let k4_2 = f2(y1 + dt * k3_1, y2 + dt * k3_2);

    y1 += (dt / 6) * (k1_1 + 2 * k2_1 + 2 * k3_1 + k4_1);
    y2 += (dt / 6) * (k1_2 + 2 * k2_2 + 2 * k3_2 + k4_2);
  }

  let trazasPlot = [{
    x: vec_t,
    y: vec_Vc,
    mode: 'lines',
    name: 'Simulación RK4 (Teórico)',
    line: { color: '#0284c7', width: 3 }
  }];

  if (dataOsciloscopio) {
    trazasPlot.push({
      x: dataOsciloscopio.t,
      y: dataOsciloscopio.V,
      mode: 'lines',
      name: 'Osciloscopio Real',
      line: { color: '#ef4444', dash: 'dot', width: 2 }
    });
  }

  Plotly.newPlot('grafico-rk4', trazasPlot, {
    title: 'Respuesta Transitoria del Capacitor Vc(t)',
    xaxis: { title: 'Tiempo (ms)' },
    yaxis: { title: 'Voltaje (V)' },
    margin: { t: 40, b: 40, l: 50, r: 20 }
  });

  // --- D. NEWTON-RAPHSON ---
  let t_i = 0.02; 

  for (let k = 0; k < 6; k++) {
    let t_sec = t_i / 1000;
    let Vc_t = Vin * (1 - Math.exp(-alpha * t_sec) * (Math.cos(omega_d * t_sec) + (alpha / omega_d) * Math.sin(omega_d * t_sec)));
    let f_t = Vc_t - Vobj;
    let dVc_dt = Vin * Math.exp(-alpha * t_sec) * ((alpha * alpha / omega_d + omega_d) * Math.sin(omega_d * t_sec));

    if (Math.abs(dVc_dt) > 1e-9) {
      t_i = t_i - (f_t / (dVc_dt / 1000));
    }
  }

  document.getElementById('info-newton').innerHTML = `
    <p><b>Voltaje Objetivo:</b> ${Vobj} V</p>
    <p><b>Tiempo de carga calculado (t*):</b> <b style="color: #10b981;">${t_i.toFixed(4)} ms</b> (${(t_i * 1000).toFixed(1)} µs)</p>
    <p><i>Este es el tiempo exacto en que la curva cruza el umbral de ${Vobj}V.</i></p>
  `;
}

// =========================================================
// 4. ARCHIVOS EXCEL Y EVENTOS
// =========================================================
document.getElementById('fileInput').addEventListener('change', function(e) {
  const archivo = e.target.files[0];
  if (!archivo) return;

  const lector = new FileReader();
  lector.onload = function(evt) {
    const data = new Uint8Array(evt.target.result);
    const libro = XLSX.read(data, { type: 'array' });
    const hoja = libro.Sheets[libro.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(hoja, { header: 1 });

    dataOsciloscopio = {
      t: json.slice(1).map(r => parseFloat(r[0])),
      V: json.slice(1).map(r => parseFloat(r[1]))
    };

    calcularTodo();
  };

  lector.readAsArrayBuffer(archivo);
});

const inputs = document.querySelectorAll('.bloque-panel input[type="number"]');
inputs.forEach(input => input.addEventListener('input', calcularTodo));

window.onload = calcularTodo;