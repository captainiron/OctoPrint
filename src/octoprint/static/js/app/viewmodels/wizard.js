$(function() {
    function WizardViewModel(parameters) {
        var self = this;

        self.loginState = parameters[0];
        self.settingsViewModel = parameters[1];

        self.wizardDialog = undefined;

        self.allViewModels = undefined;

        self.finishing = false;

        self.isDialogActive = function() {
            return self.wizardDialog.is(":visible");
        };

        self.showDialog = function() {
            if (!CONFIG_WIZARD || !(CONFIG_FIRST_RUN || self.loginState.isAdmin())) return;

            self.getWizardDetails(function(response) {
                callViewModels(self.allViewModels, "onWizardDetails", [response]);

                if (!self.isDialogActive()) {
                    self.wizardDialog.modal({
                        minHeight: function() { return Math.max($.fn.modal.defaults.maxHeight() - 80, 250); }
                    }).css({
                        width: 'auto',
                        'margin-left': function() { return -($(this).width() /2); }
                    });
                }
            });
        };

        self.closeDialog = function() {
            self.wizardDialog.modal("hide");
        };

        self.onStartup = function() {
            self.wizardDialog = $("#wizard_dialog");
        };

        self.onUserLoggedIn = function() {
            self.showDialog();
        };

        self.onAllBound = function(allViewModels) {
            self.allViewModels = allViewModels;
            self.wizardDialog.bootstrapWizard({
                tabClass: "nav nav-list",
                nextSelector: ".button-next",
                previousSelector: ".button-previous",
                finishSelector: ".button-finish",
                onTabClick: function() {
                    // we don't allow clicking on the tabs
                    return false;
                },
                onTabShow: function(tab, navigation, index) {
                    if (index < 0 || tab.length == 0) {
                        return true;
                    }

                    var total = self.wizardDialog.bootstrapWizard("navigationLength");

                    if (index == total) {
                        self.wizardDialog.find(".button-next").hide();
                        self.wizardDialog.find(".button-finish").show().removeClass("disabled");
                    } else {
                        self.wizardDialog.find(".button-finish").hide();
                        self.wizardDialog.find(".button-next").show();
                    }

                    var active = tab[0].id;
                    if (active != undefined) {
                        callViewModels(allViewModels, "onAfterWizardTabChange", [active]);
                    }
                },
                onTabChange: function(tab, navigation, index, nextTabIndex, nextTab) {
                    var current, next;

                    if (index == undefined || index < 0 ||
                        nextTabIndex == undefined || nextTabIndex < 0 ||
                        index == nextTabIndex ||
                        tab.length == 0 || nextTab.length == 0) {
                        // let's ignore that nonsense
                        return;
                    }

                    current = tab[0].id;
                    next = nextTab[0].id;

                    if (current != undefined && next != undefined) {
                        var result = true;
                        callViewModels(allViewModels, "onWizardTabChange", function(method) {
                            result = result && (method(current, next) !== false);
                        });
                        return result;
                    }
                },
                onFinish: function(tab, navigation, index) {
                    var closeDialog = true;
                    callViewModels(allViewModels, "onBeforeWizardFinish", function(method) {
                        closeDialog = closeDialog && (method() !== false);
                    });

                    if (closeDialog) {
                        callViewModels(allViewModels, "onWizardFinish");
                        self.finishWizard(function() {
                            self.closeDialog();
                        });
                    }
                }
            });
            self.showDialog();
        };

        self.getWizardDetails = function(callback) {
            if (!callback) return;

            $.ajax({
                url: API_BASEURL + "setup/wizard",
                type: "GET",
                dataType: "json",
                success: callback
            });
        };

        self.finishWizard = function(callback) {
            self.finishing = true;

            self.settingsViewModel.saveEnqueued();
            $.ajax({
                url: API_BASEURL + "setup/wizard",
                type: "POST",
                dataType: "json",
                contentType: "application/json; charset=UTF-8",
                success: function() {
                    self.finishing = false;
                    callback();
                },
                failure: function() {
                    self.finishing = false;
                }
            })
        };

        self.onSettingsPreventRefresh = function() {
            if (!self.finishing && self.isDialogActive()
                && hasDataChanged(self.settingsViewModel.getLocalData(), self.settingsViewModel.lastReceivedSettings)) {
                // we have local changes, show update dialog
                self.settingsViewModel.settingsUpdatedDialog.modal("show");
                return true;
            }

            return false;
        }
    }

    OCTOPRINT_VIEWMODELS.push([
        WizardViewModel,
        ["loginStateViewModel", "settingsViewModel"],
        "#wizard_dialog"
    ]);
});