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

@RunWith(AndroidJUnit4.class)
public class ArborIntelInventoryEndToEndTest {
 @Rule public ActivityScenarioRule<MainActivity> activityRule=new ActivityScenarioRule<>(MainActivity.class);
 @Rule public GrantPermissionRule permissions=GrantPermissionRule.grant(Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION,Manifest.permission.CAMERA);
 private void settle(long m){SystemClock.sleep(m);} private void clickId(String id){onWebView().withElement(findElement(Locator.ID,id)).perform(webClick());}
 private void bodyContains(String t){onWebView().withElement(findElement(Locator.TAG_NAME,"body")).check(webMatches(getText(),containsString(t)));}
 private void loadPath(String path,long wait){settle(2500);activityRule.getScenario().onActivity(a->{WebView w=a.getBridge().getWebView();String c=w.getUrl();if(c==null)return;int s=c.indexOf("://"),x=s<0?-1:c.indexOf('/',s+3);String o=x<0?c:c.substring(0,x);w.loadUrl(o+path);});settle(wait);onWebView().forceJavascriptEnabled();}
 @Test public void srsFixtureLoadsExplicitPreselectedSampleAndPreservesDraw(){loadPath("/firebase/testlab/fixture.html?mode=srs",10000);onWebView().withElement(findElement(Locator.ID,"projectName")).check(webMatches(getText(),containsString("__ARBOR_INTEL_FIREBASE_QA__")));onWebView().withElement(findElement(Locator.ID,"protocolName")).check(webMatches(getText(),containsString("SRS")));clickId("plotsBtn");settle(1200);bodyContains("QA-SRS-001");bodyContains("QA-SRS-002");onWebView().withElement(findElement(Locator.ID,"plDrawSrs")).perform(webClick());settle(900);bodyContains("Sorteio preservado");bodyContains("2 parcelas selecionadas");}
 @Test public void newTreeCannotBypassPlotSelectionAndVisitFlow(){loadPath("/firebase/testlab/fixture.html?mode=srs",10000);clickId("addTreeBtn");settle(900);bodyContains("QA-SRS-001");bodyContains("QA-SRS-002");}
 @Test public void srsLiveStatisticsSurfaceLoadsWithoutChangingSample(){loadPath("/firebase/testlab/fixture.html?mode=srs",10000);clickId("dataBtn");settle(1200);bodyContains("Memória estatística");bodyContains("Protocolo");bodyContains("SRS");}
 @Test public void selectedSrsPlotOpensStakeoutWithoutChangingSamplingSelection(){loadPath("/firebase/testlab/fixture.html?mode=srs",10000);clickId("plotsBtn");settle(900);onWebView().withElement(findElement(Locator.CSS_SELECTOR,"[data-plot]")).perform(webClick());settle(700);bodyContains("Área horizontal");bodyContains("Navegar");bodyContains("SRS");}
 @Test public void spatialV19RequiresExplicitCenterChoiceAndDoesNotCreateOnOpen(){loadPath("/firebase/testlab/fixture.html?mode=spatial",10000);clickId("plotsBtn");settle(900);clickId("allocPlot");settle(900);bodyContains("Minha posição");bodyContains("Tocar no mapa");bodyContains("Importar");bodyContains("Abrir a tela, mover o mapa ou obter GPS não cria parcela");onWebView().withElement(findElement(Locator.ID,"v19CenterState")).check(webMatches(getText(),containsString("Nenhum centro confirmado")));clickId("v19Cancel");}
}
