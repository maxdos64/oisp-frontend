/**
 * Copyright (c) 2014 Intel Corporation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';
var expect = require('expect.js'),
    sinon = require('sinon'),
    rewire = require('rewire'),
    Q = require('q'),
    errBuilder = require('../../../../../lib/errorHandler').errBuilder,
    rulesManager = rewire('../../../../../engine/api/v1/rules');

describe('rules api', function(){
    var domain = {
            id: Math.random().toString()
        },
        user = {
            id: '1',
            email: 'test@test.com'
        },
        account = {
            public_id: domain.id
        },
        rule = {
            accountId: domain.id,
            name: 'test-rule1',
            description: 'my first rule',
            type: 'Regular',
            resetType: 'Automatic',
            priority: 'High',
            status: 'Active',
            population: {
                tags: ['arg',  'jujuy']
            },
            conditions: {
                operator: 'OR',
                values: [
                    {
                        component: {
                            name: 'Temp Sensor 1',
                            dataType: 'Number',
                            cid: 'component-12345'
                        },
                        type: 'Basic condition',
                        operator: 'Equal',
                        values: [10]
                    }
                ]
            },
            actions: [
                {
                    notify: {
                        type: 'mail',
                        target: ['ricardo@mail.com']
                    }
                }
            ]
        },
        savedRule, userProxy, ruleMock, callback, accountMock;

    beforeEach(function(){
        savedRule = {};
        rule.conditions.values[0].operator = "Equal";
        userProxy = {
            findById: sinon.stub().returns(Q.resolve(user))
        };
        ruleMock = {
            addOrUpdateDraft: sinon.stub().returns(Q.resolve(savedRule)),
            ruleStatus: {
                active:"active",
                archived:"archived",
                draft:"draft"
            },
            findAccountWithRule: sinon.stub().returns(Q.resolve({
                rule:rule,
                account:account
            })),
            findUserWithAccountAndRule: sinon.stub().returns(Q.resolve({})),
            all: sinon.stub().returns(Q.resolve([rule])),
            update: sinon.stub().returns(Q.resolve(rule)),
            deleteDraft: sinon.stub().returns(Q.resolve({deleted:true})),
            deleteRule: sinon.stub().returns(Q.resolve({deleted:true})),
            findByStatus: sinon.stub()
        };

        accountMock = {
            find: sinon.stub().callsArgWith(1, null, account)
        };

        callback = sinon.spy();

        rulesManager.__set__('User', userProxy);
        rulesManager.__set__('Rule', ruleMock);
        rulesManager.__set__('Account', accountMock);

    });



    describe('add rule', function(){
        it('should add rule if everything is ok', function(done){
            // execute
            rulesManager.addRule({domainId: domain.id, userId: user.id, rule: rule}, callback)
                .then(function(){
                    // attest
                    expect(callback.calledWith(null, savedRule)).to.equal(true);
                    expect(ruleMock.addOrUpdateDraft.calledOnce).to.equal(true);
                    expect(ruleMock.addOrUpdateDraft.args[0].length).to.equal(3);
                    var actual = ruleMock.addOrUpdateDraft.args[0][2];
                    expect(actual.externalId).to.equal(rule.externalId);
                    expect(actual.actions).to.equal(rule.actions);
                    expect(actual.accountId).to.equal(domain.id);

                    done();
                })
                .catch(function(err){
                    done(err);
                });
        });

        it('should call callback with error Rule.InvalidData if there is any validation error', function(done){
            // prepare
            rule.conditions.values[0].operator = "error_operator";
            // execute
            rulesManager.addRule({domain: domain, userId: user.id, rule: rule}, callback);

            // attest
            expect(callback.calledOnce).to.equal(true);
            expect(callback.args[0].length).to.equal(1);
            expect(callback.args[0][0].code).to.equal(errBuilder.Errors.Rule.InvalidData.code);
            expect(callback.args[0][0]).to.have.property('errors');
            expect(callback.args[0][0].errors.length).to.equal(1);

            expect(ruleMock.addOrUpdateDraft.calledOnce).to.equal(false);
            done();

        });

        it('should call callback with error Generic.InternalServerError if something weird happens when saving', function(done){
            // prepare
            ruleMock.addOrUpdateDraft.returns(Q.reject());

            // execute
            rulesManager.addRule({domain: domain, userId: user.id, rule: rule}, callback)
                .then(function(){
                    // attest
                    expect(callback.calledOnce).to.equal(true);
                    expect(callback.args[0].length).to.equal(1);
                    expect(callback.args[0][0].code).to.equal(errBuilder.Errors.Generic.InternalServerError.code);

                    expect(ruleMock.addOrUpdateDraft.calledOnce).to.equal(true);

                    done();
                })
                .catch(function(err){
                    done(err);
                });
        });

        it('should call callback with error Account.NotFound if account was not found', function(done){
            // prepare
            accountMock.find.callsArgWith(1, null, null);

            // execute
            rulesManager.addRule({domain: domain, userId: user.id, rule: rule}, callback)
                .then(function(){
                    // attest
                    expect(callback.calledOnce).to.equal(true);
                    expect(callback.args[0].length).to.equal(1);
                    expect(callback.args[0][0].code).to.equal(errBuilder.Errors.Account.NotFound.code);
                    expect(ruleMock.addOrUpdateDraft.calledOnce).to.equal(false);

                    done();
                })
                .catch(function(err){
                    done(err);
                });
        });


    });

    describe('get rule', function(){
        it('should call callback with returned object if everything is ok', function(done){
            // execute
            rulesManager.getRule({domain: domain, externalId: 1}, callback)
                .then(function(){
                    // attest
                    expect(callback.calledWith(null, rule)).to.equal(true);
                    done();
                })
                .catch(function(err){
                    done(err);
                });
        });

        it('should call callback with Generic.InternalServerError error if findAccountWithRule fails', function(done){
            // prepare
            ruleMock.findAccountWithRule.returns(Q.reject());

            // execute
            rulesManager.getRule({domain: domain, externalId: 1}, callback)
                .then(function(){
                    // attest
                    expect(callback.calledOnce).to.equal(true);
                    expect(callback.args[0].length).to.equal(1);
                    expect(callback.args[0][0].code).to.equal(errBuilder.Errors.Generic.InternalServerError.code);

                    expect(ruleMock.findAccountWithRule.calledOnce).to.equal(true);

                    done();
                })
                .catch(function(err){
                    done(err);
                });
        });


    });

    describe('get rules', function(){
        it('should call callback with all returned rules', function(done){
            // execute
            rulesManager.getRules(domain, callback)
                .then(function(){
                    // attest
                    expect(callback.calledOnce).to.equal(true);
                    expect(callback.args[0].length).to.equal(2);
                    expect(callback.args[0][1].length).to.equal(1);
                    expect(callback.args[0][1][0].id).to.equal(rule.id);


                    done();
                })
                .catch(function(err){
                    done(err);
                });
        });

        it('should call callback with Generic.InternalServerError error if something crashes when getting rules', function(done){
            // prepare
            ruleMock.all.returns(Q.reject());

            // execute
            rulesManager.getRules(domain, callback)
                .then(function(){
                    // attest
                    expect(callback.calledOnce).to.equal(true);
                    expect(callback.args[0].length).to.equal(1);
                    expect(callback.args[0][0].code).to.equal(errBuilder.Errors.Generic.InternalServerError.code);

                    done();
                })
                .catch(function(err){
                    done(err);
                });
        });

    });

    describe('update rule', function(){
        it('should call callback with new object if proxy replies a 201 http status', function(done){
            // prepare
            var newRule = {
                status: ruleMock.ruleStatus.archived,
                accountId: domain.id,
                name: 'test-rule1',
                description: 'my first rule',
                type: 'Regular',
                resetType: 'Automatic',
                priority: 'High',
                population: {
                    tags: ['arg',  'jujuy']
                },
                conditions: {
                    operator: 'OR',
                    values: [
                        {
                            component: {
                                name: 'Temp Sensor 1',
                                dataType: 'Number'
                            },
                            type: 'Basic condition',
                            operator: 'Equal',
                            values: [10]
                        }
                    ]
                },
                actions: [
                    {
                        notify: {
                            type: 'mail',
                            target: ['ricardo@mail.com']
                        }
                    }
                ]
            };
            ruleMock.addOrUpdateDraft.returns(Q.resolve(newRule));
            // execute
            rulesManager.updateRule({domain: domain, user: user.id, rule: newRule, externalId: '1'}, callback)
                .then(function(){
                    // attest
                    expect(callback.calledWith(null, newRule)).to.equal(true);
                    expect(ruleMock.addOrUpdateDraft.calledOnce).to.equal(true);
                    expect(ruleMock.addOrUpdateDraft.args[0].length).to.equal(3);
                    expect(ruleMock.addOrUpdateDraft.args[0][2].status).to.equal(ruleMock.ruleStatus.archived);
                    done();
                })
                .catch(function(err){
                    done(err);
                });
        });

        it('should call callback with 7400 error if there is any validation error', function(done){
            // prepare
            rule.conditions.values[0].operator = "error_operator";
            // execute
            rulesManager.updateRule({domain: domain, userId: user.id, rule: rule}, callback);

            // attest
            expect(callback.calledOnce).to.equal(true);
            expect(callback.args[0].length).to.equal(1);
            expect(callback.args[0][0].code).to.equal(errBuilder.Errors.Rule.InvalidData.code);
            expect(callback.args[0][0]).to.have.property('errors');
            expect(callback.args[0][0].errors.length).to.equal(1);

            expect(ruleMock.addOrUpdateDraft.calledOnce).to.equal(false);
            done();
        });

        it('should call callback with .InternalError.UpdatingError error if something goes wrong when updating rule', function(done){
            // prepare
            ruleMock.addOrUpdateDraft.returns(Q.reject());
            // execute
            rulesManager.updateRule({domain: domain, userId: user.id, rule: rule}, callback)
                .then(function(){
                    // attest
                    expect(callback.calledOnce).to.equal(true);
                    expect(callback.args[0].length).to.equal(1);
                    expect(callback.args[0][0].code).to.equal(errBuilder.Errors.Rule.InternalError.UpdatingError.code);
                    expect(ruleMock.addOrUpdateDraft.calledOnce).to.equal(true);
                    done();
                })
                .catch(function(err){
                    done(err);
                });
        });

        it('should call callback with Generic.InternalServerError error if rules does not exist', function(done){
            // prepare
            ruleMock.findUserWithAccountAndRule.returns(Q.reject());
            // execute
            rulesManager.updateRule({domain: domain, userId: user.id, rule: rule}, callback)
                .then(function(){
                    // attest
                    expect(callback.calledOnce).to.equal(true);
                    expect(callback.args[0].length).to.equal(1);
                    expect(callback.args[0][0].code).to.equal(errBuilder.Errors.Generic.InternalServerError.code);
                    expect(ruleMock.addOrUpdateDraft.calledOnce).to.equal(false);
                    done();
                })
                .catch(function(err){
                    done(err);
                });
        });

        it('should call callback with Generic.InternalServerError error if user does not exist', function(done){
            // prepare
            userProxy.findById.returns(Q.reject());
            // execute
            rulesManager.updateRule({domain: domain, userId: user.id, rule: rule}, callback)
                .then(function(){
                    // attest
                    expect(callback.calledOnce).to.equal(true);
                    expect(callback.args[0].length).to.equal(1);
                    expect(callback.args[0][0].code).to.equal(errBuilder.Errors.Generic.InternalServerError.code);
                    expect(ruleMock.addOrUpdateDraft.calledOnce).to.equal(false);
                    done();
                })
                .catch(function(err){
                    done(err);
                });
        });
    });

    describe('update rule status', function(){
        it('should call callback with update object (new status) if everything is ok', function(done){
            // prepare
            var newStatus = "newStatus",
                externalId = '1',
                updatedRule = {
                    externalId: externalId,
                    lastUpdateDate: rule.lastUpdateDate,
                    status: newStatus
                };

            // execute
            rulesManager.updateRuleStatus({domain: domain, externalId: externalId, status: newStatus}, callback)
                .then(function(){
                    // attest
                    expect(callback.calledOnce).to.equal(true);
                    expect(callback.args[0].length).to.equal(2);

                    expect(ruleMock.update.calledWith(externalId, account.public_id, updatedRule)).to.equal(true);
                    done();
                })
                .catch(function(err){
                    done(err);
                });
        });

        it('should call callback with InternalError.UpdatingError error if something crashes when updating rule', function(done){
            // prepare
            var newStatus = "newStatus",
                externalId = '1';
                ruleMock.update.returns(Q.reject())
            // execute
            rulesManager.updateRuleStatus({domain: domain, externalId: externalId, status: newStatus}, callback)
                .then(function(){
                    // attest
                    expect(callback.calledOnce).to.equal(true);
                    expect(callback.args[0].length).to.equal(1);
                    expect(callback.args[0][0].code).to.equal(errBuilder.Errors.Rule.InternalError.UpdatingError.code);
                    done();
                })
                .catch(function(err){
                    done(err);
                });
        });

        it('should call callback with Generic.InternalServerError error if rule does not exist', function(done){
            // prepare
            var newStatus = "newStatus",
                externalId = '1';
            ruleMock.findAccountWithRule.returns(Q.reject())
            // execute
            rulesManager.updateRuleStatus({domain: domain, externalId: externalId, status: newStatus}, callback)
                .then(function(){
                    // attest
                    expect(callback.calledOnce).to.equal(true);
                    expect(callback.args[0].length).to.equal(1);
                    expect(callback.args[0][0].code).to.equal(errBuilder.Errors.Generic.InternalServerError.code);
                    done();
                })
                .catch(function(err){
                    done(err);
                });
        });
    });

    describe('add rule as draft', function(){
        it('should add or update rule if everything is ok', function(done){
            // execute
            rulesManager.addRuleAsDraft({domainId: domain.id, userId: user.id, rule: rule}, callback)
                .then(function(){
                    // attest
                    expect(callback.calledWith(null, savedRule)).to.equal(true);
                    expect(ruleMock.addOrUpdateDraft.calledOnce).to.equal(true);
                    expect(ruleMock.addOrUpdateDraft.args[0].length).to.equal(3);
                    var actual = ruleMock.addOrUpdateDraft.args[0][2];
                    expect(actual.externalId).to.equal(rule.externalId);
                    expect(actual.actions).to.equal(rule.actions);
                    expect(actual.accountId).to.equal(domain.id);
                    expect(actual.status).to.equal(ruleMock.ruleStatus.draft);

                    done();
                })
                .catch(function(err){
                    done(err);
                });
        });

        it('should call callback with error Generic.InternalServerError if something weird happens when saving', function(done){
            // prepare
            ruleMock.addOrUpdateDraft.returns(Q.reject());

            // execute
            rulesManager.addRuleAsDraft({domain: domain, userId: user.id, rule: rule}, callback)
                .then(function(){
                    // attest
                    expect(callback.calledOnce).to.equal(true);
                    expect(callback.args[0].length).to.equal(1);
                    expect(callback.args[0][0].code).to.equal(errBuilder.Errors.Generic.InternalServerError.code);

                    expect(ruleMock.addOrUpdateDraft.calledOnce).to.equal(true);

                    done();
                })
                .catch(function(err){
                    done(err);
                });
        });

        it('should call callback with error User.NotFound if user was not found', function(done){
            // prepare
            userProxy.findById.returns(Q.resolve(null));

            // execute
            rulesManager.addRule({domain: domain, userId: user.id, rule: rule}, callback)
                .then(function(){
                    // attest
                    expect(callback.calledOnce).to.equal(true);
                    expect(callback.args[0].length).to.equal(1);
                    expect(callback.args[0][0].code).to.equal(errBuilder.Errors.User.NotFound.code);
                    expect(ruleMock.addOrUpdateDraft.calledOnce).to.equal(false);

                    done();
                })
                .catch(function(err){
                    done(err);
                });
        });

    });

    describe('delete draft', function(){
        it('should delete draft if everything is ok', function(done){
            // execute
            rulesManager.deleteDraft({domain: domain, externalId: '1'}, callback)
                .then(function(){
                    // attest
                    expect(callback.calledOnce).to.equal(true);
                    expect(callback.args[0].length).to.equal(2);
                    expect(callback.args[0][0]).to.equal(null);
                    expect(callback.args[0][1].deleted).to.equal(true);
                    expect(ruleMock.deleteDraft.calledOnce).to.equal(true);

                    done();
                })
                .catch(function(err){
                    done(err);
                });
        });

        it('should call callback with Generic.InternalServerError error if something crashes', function(done){
            //arrange
            ruleMock.deleteDraft.returns(Q.reject({}))
            // execute
            rulesManager.deleteDraft({domain: domain, externalId: '1'}, callback)
                .then(function(){
                    // attest
                    expect(callback.calledOnce).to.equal(true);
                    expect(callback.args[0].length).to.equal(1);
                    expect(callback.args[0][0].code).to.equal(errBuilder.Errors.Generic.InternalServerError.code);
                    expect(ruleMock.deleteDraft.calledOnce).to.equal(true);

                    done();
                })
                .catch(function(err){
                    done(err);
                });
        });
    });

    describe('group by componentId', function() {
        it('should group rules by componentId', function () {
            //arrange
            var rule_a = {name: 'rule_a', conditions: {values:[{component: {cid: 'compid_a'}}, {component: {cid: 'compid_b'}}, {component: {cid: 'compid_a'}}]}};
            var rule_b = {name: 'rule_b', conditions: {values:[{component: {cid: 'compid_b'}}]}};
            ruleMock.findByStatus.returns(Q.resolve([rule_a, rule_b]));

            //execute
            var result = rulesManager.groupByComponentId('active', callback);

            //assert
            return result.then(function() {
                expect(callback.calledOnce).to.equal(true);
                expect(callback.args[0].length).to.equal(2);
                expect(callback.args[0][0]).to.equal(null);
                var res = callback.args[0][1];
                expect(res).to.have.length(2);
                expect(res).to.eql([{componentId: 'compid_a', rules: [rule_a]}, {componentId: 'compid_b', rules: [rule_a, rule_b]}]);
            });
        });
    });

    describe('delete rule', function(){
        it('should delete rule if everything is ok', function(done){
            // execute
            rulesManager.deleteRule({domain: domain, externalId: '1'}, callback)
                .then(function(){
                    // attest
                    expect(callback.calledOnce).to.equal(true);
                    expect(callback.args[0].length).to.equal(2);
                    expect(callback.args[0][0]).to.equal(null);
                    expect(callback.args[0][1].deleted).to.equal(true);
                    expect(ruleMock.deleteRule.calledOnce).to.equal(true);

                    done();
                })
                .catch(function(err){
                    done(err);
                });
        });

        it('should call callback with Generic.InternalServerError error if something crashes', function(done){
            //arrange
            ruleMock.deleteRule.returns(Q.reject({}))
            // execute
            rulesManager.deleteRule({domain: domain, externalId: '1'}, callback)
                .then(function(){
                    // attest
                    expect(callback.calledOnce).to.equal(true);
                    expect(callback.args[0].length).to.equal(1);
                    expect(callback.args[0][0].code).to.equal(errBuilder.Errors.Generic.InternalServerError.code);
                    expect(ruleMock.deleteRule.calledOnce).to.equal(true);

                    done();
                })
                .catch(function(err){
                    done(err);
                });
        });
    });
});