package br.com.arborintel.testlab;

import android.Manifest;
import android.os.SystemClock;
import android.webkit.WebView;
import androidx.test.ext.junit.rules.ActivityScenarioRule;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.rule.GrantPermissionRule;
import androidx.test.espresso.web.webdriver.Locator;
import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;
import static androidx.test.espresso.web.assertion.WebViewAssertions.webMatches;
import static androidx.test.espresso.web.sugar.Web.onWebView;
import static androidx.test.espresso.web.webdriver.DriverAtoms.findElement;
import static androidx.test.espresso.web.webdriver.DriverAtoms.getText;
import static androidx.test.espresso.web.webdriver.DriverAtoms.webClick;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;

@RunWith(AndroidJUnit4.class)
public class ArborIntelWholeAppTest {
 @Rule public ActivityScenarioRule<MainActivity> activityRule=new ActivityScenarioRule<>(MainActivity.class);
 @Rule public GrantPermissionRule permissions=GrantPermissionRule.grant(Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION,Manifest.permission.CAMERA);
 private void settle(long m){SystemClock.sleep(m);} private void prepare(){settle(6500);onWebView().forceJavascriptEnabled();}
 private void clickId(String id){onWebView().withElement(findElement(Locator.ID,id)).perform(webClick());}
 private void bodyContains(String t){onWebView().withElement(findElement(Locator.TAG_NAME,"body")).check(webMatches(getText(),containsString(t)));}
 private void loadPath(String path){activityRule.getScenario().onActivity(a->{WebView w=a.getBridge().getWebView();String c=w.getUrl();if(c==null)return;int s=c.indexOf("://"),x=s<0?-1:c.indexOf('/',s+3);String o=x<0?c:c.substring(0,x);w.loadUrl(o+path);});settle(5000);onWebView().forceJavascriptEnabled();}
 @Test public void urbanShellLoadsMapGpsAndCoreFieldControls(){prepare();for(String id:new String[]{"brandBtn","layersBtn","dataBtn","cameraBtn","locateBtn","toolsBtn","syncState","map"})onWebView().withElement(findElement(Locator.ID,id));onWebView().withElement(findElement(Locator.ID,"hudGps")).check(webMatches(getText(),containsString("GPS")));}
 @Test public void urbanWorkspaceShowsUrbanAndInventoryModules(){prepare();clickId("brandBtn");settle(1200);bodyContains("Avaliação de árvores urbanas");bodyContains("Inventário florestal");bodyContains("Novo projeto urbano");}
 @Test public void urbanLayersPanelIsUsable(){prepare();clickId("layersBtn");settle(900);bodyContains("Híbrido");bodyContains("Satélite");bodyContains("Terreno");bodyContains("Ruas");}
 @Test public void urbanDataPanelExposesImportExportAndOfflineControls(){prepare();clickId("dataBtn");settle(900);for(String t:new String[]{"CSV","XLSX","GeoJSON","KML/KMZ","SHP ZIP","Dados offline"})bodyContains(t);}
 @Test public void urbanCameraGuidanceOpensAndCanBeClosed(){prepare();clickId("cameraBtn");settle(1800);onWebView().withElement(findElement(Locator.ID,"captureStep")).check(webMatches(getText(),containsString("1 / 6")));bodyContains("Árvore inteira");clickId("captureClose");}
 @Test public void urbanLanguageCanCycleWithoutLosingPrimaryNavigation(){prepare();activityRule.getScenario().onActivity(a->a.getBridge().getWebView().evaluateJavascript("localStorage.setItem('arbor_intel_lang_v2','pt-BR');location.reload();",null));settle(4500);onWebView().forceJavascriptEnabled();clickId("langBtn");settle(400);onWebView().withElement(findElement(Locator.ID,"langBtn")).check(webMatches(getText(),containsString("EN")));bodyContains("Layers");bodyContains("Data");bodyContains("Locate");}
 @Test public void inventoryLandingRemainsProjectFirstWhenOpenedDirectly(){prepare();loadPath("/inventory.html");onWebView().withElement(findElement(Locator.ID,"startTitle")).check(webMatches(getText(),containsString("Defina o projeto de inventário")));bodyContains("Primeiro o projeto. Depois o desenho amostral. Só então o campo.");bodyContains("Nenhuma parcela será criada automaticamente");}
}
