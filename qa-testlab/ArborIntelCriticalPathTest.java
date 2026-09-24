package br.com.arborintel.testlab;

import android.Manifest;
import android.os.SystemClock;

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
public class ArborIntelCriticalPathTest {
    @Rule public ActivityScenarioRule<MainActivity> activityRule = new ActivityScenarioRule<>(MainActivity.class);
    @Rule public GrantPermissionRule permissions = GrantPermissionRule.grant(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.CAMERA);
    private void settle(long millis){ SystemClock.sleep(millis); }

    @Test public void inventoryEntryStopsAtExplicitProjectGate(){
        settle(4500); onWebView().forceJavascriptEnabled();
        onWebView().withElement(findElement(Locator.ID,"brandBtn")).perform(webClick()); settle(900);
        onWebView().withElement(findElement(Locator.CSS_SELECTOR,"[data-module='inventory'],[data-module='srs']")).perform(webClick()); settle(4200);
        onWebView().withElement(findElement(Locator.ID,"startTitle")).check(webMatches(getText(),containsString("Defina o projeto de inventário")));
        onWebView().withElement(findElement(Locator.TAG_NAME,"body")).check(webMatches(getText(),containsString("Primeiro o projeto. Depois o desenho amostral. Só então o campo.")));
        onWebView().withElement(findElement(Locator.ID,"newProjectForm"));
    }

    @Test public void directFieldAccessWithoutAuthorizationIsRejected(){
        settle(4500); onWebView().forceJavascriptEnabled();
        activityRule.getScenario().onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript("sessionStorage.removeItem('arbor_inventory_entry_authorized_v19');localStorage.removeItem('arbor_intel_project_v2');location.href='/inventory-field.html';",null));
        settle(4200);
        onWebView().withElement(findElement(Locator.ID,"startTitle")).check(webMatches(getText(),containsString("Defina o projeto de inventário")));
        onWebView().withElement(findElement(Locator.TAG_NAME,"body")).check(webMatches(getText(),containsString("Só então o campo")));
    }
}
