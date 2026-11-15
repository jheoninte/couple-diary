const slides=document.getElementById('slides'),next=document.getElementById('next'),dots=[...document.querySelectorAll('.dots button')];
let page=0;
function go(index){slides.scrollTo({left:Math.max(0,Math.min(3,index))*slides.clientWidth,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
function finish(signup=false){
  try{localStorage.setItem('diary.onboarding.v1','done');}catch{}
  const params=new URLSearchParams(location.search);
  if(signup)params.set('signup','1');
  // Preserve language preference already set in localStorage
  location.replace('login.html'+(params.size?'?'+params:''));
}
slides.addEventListener('scroll',()=>{page=Math.round(slides.scrollLeft/slides.clientWidth);dots.forEach((dot,i)=>{if(i===page)dot.setAttribute('aria-current','step');else dot.removeAttribute('aria-current');});next.textContent=page===3?'우리의 공간 시작하기':'다음';},{passive:true});
slides.addEventListener('keydown',event=>{if(event.key==='ArrowRight'){event.preventDefault();go(page+1);}if(event.key==='ArrowLeft'){event.preventDefault();go(page-1);}});
dots.forEach((dot,i)=>dot.onclick=()=>go(i));
next.onclick=()=>page===3?finish(true):go(page+1);
document.getElementById('skip').onclick=()=>finish();
document.getElementById('login').onclick=()=>finish();
// Smooth entry: if already done, skip immediately
try{if(localStorage.getItem('diary.onboarding.v1')==='done')location.replace('login.html'+location.search);}catch{}
