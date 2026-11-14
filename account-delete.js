import {auth,functions,pageURL} from './firebase-config.js';
import {onAuthStateChanged,EmailAuthProvider,reauthenticateWithCredential,signOut} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {httpsCallable} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js';
import {mountDeletionUI} from './deletion-ui.js';
let storage;try{storage=window.localStorage;}catch{storage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};}
mountDeletionUI({document,storage,auth,pageURL,
 subscribe:listener=>onAuthStateChanged(auth,listener),
 reauthenticate:(user,password)=>reauthenticateWithCredential(user,EmailAuthProvider.credential(user.email,password)),
 remote:async(action,data={})=>(await httpsCallable(functions,'accountDeletion')({action,...data})).data,
 signOut:()=>signOut(auth),
});
