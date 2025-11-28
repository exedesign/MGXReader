// Browser console'da çalıştırın:
// localStorage.clear(); 
// window.location.reload();

// veya direkt bu fonksiyonu çağırın:
function resetModels() {
  console.log('🔄 Resetting localStorage...');
  localStorage.clear();
  console.log('🔄 Reloading page...');
  window.location.reload();
}

// resetModels();

console.log('Debug script loaded. Browser console\'da "resetModels()" çağırın.');